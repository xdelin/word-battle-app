package com.wordbattle.review;

import com.fasterxml.jackson.core.type.TypeReference;
import com.wordbattle.book.Book;
import com.wordbattle.book.BookRepository;
import com.wordbattle.lesson.Card;
import com.wordbattle.lesson.CardRepository;
import com.wordbattle.lesson.JsonbHelper;
import com.wordbattle.lesson.dto.CollocationDto;
import com.wordbattle.lesson.dto.DefinitionDto;
import com.wordbattle.lesson.dto.ExampleDto;
import com.wordbattle.lesson.dto.FormDto;
import com.wordbattle.review.dto.AddToReviewRequest;
import com.wordbattle.review.dto.InPlanWordsRequest;
import com.wordbattle.review.dto.InPlanWordsResponse;
import com.wordbattle.review.dto.MasterWordRequest;
import com.wordbattle.review.dto.ReviewCardDto;
import com.wordbattle.review.dto.ReviewItemDto;
import com.wordbattle.review.dto.ReviewItemDto.ProgressDto;
import com.wordbattle.review.dto.ReviewQueueResponse;
import com.wordbattle.review.dto.ReviewRatingRequest;
import com.wordbattle.review.dto.ReviewRatingResponse;
import com.wordbattle.review.dto.WordsDetailRequest;
import com.wordbattle.user.CurrentUserResolver;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 复习服务：队列查询 + 评分提交 + 加入复习 + 熟记。
 * 1:1 复刻前端 app/api/review/route.ts 与 actions/review-plan.ts。
 */
@Service
@Transactional
public class ReviewService {

    private static final int PAGE_LIMIT = 20;
    // 到期卡上限：放宽到足以覆盖用户实际到期量，确保"加入复习"的新词（due=now）不会因到期词过多而被截断。
    // 全新卡仍按 PAGE_LIMIT 补足保底。到期卡实际不会接近此量级。
    private static final int DUE_LIMIT = 500;
    private static final List<String> HIDDEN_BOOK_SHORT_NAMES = List.of("WQ-L1");

    private static final TypeReference<List<DefinitionDto>> DEFS = new TypeReference<>() {};
    private static final TypeReference<List<ExampleDto>> EX = new TypeReference<>() {};
    private static final TypeReference<List<FormDto>> FORMS = new TypeReference<>() {};
    private static final TypeReference<List<CollocationDto>> COLS = new TypeReference<>() {};
    private static final TypeReference<List<com.wordbattle.lesson.dto.ConfusableDto>> CONF = new TypeReference<>() {};

    private final UserCardProgressRepository progressRepository;
    private final UserMasteredWordRepository masteredRepository;
    private final CardRepository cardRepository;
    private final BookRepository bookRepository;
    private final JsonbHelper jsonb;
    private final CurrentUserResolver currentUser;
    private final com.wordbattle.progress.StudyStatsService studyStatsService;

    /** 隐藏词库 bookId 缓存（启动后不变，按 shortName 查一次）。 */
    private final ConcurrentHashMap<String, Integer> hiddenBookIdCache = new ConcurrentHashMap<>();

    public ReviewService(UserCardProgressRepository progressRepository,
                         UserMasteredWordRepository masteredRepository,
                         CardRepository cardRepository,
                         BookRepository bookRepository,
                         JsonbHelper jsonb,
                         CurrentUserResolver currentUser,
                         com.wordbattle.progress.StudyStatsService studyStatsService) {
        this.progressRepository = progressRepository;
        this.masteredRepository = masteredRepository;
        this.cardRepository = cardRepository;
        this.bookRepository = bookRepository;
        this.jsonb = jsonb;
        this.currentUser = currentUser;
        this.studyStatsService = studyStatsService;
    }

    private UUID userId() {
        return UUID.fromString(currentUser.getUserId());
    }

    /** 隐藏词库 bookId（WQ-L1）。可能有多个隐藏词库，这里只取第一个（与前端单隐藏一致）。 */
    private Integer hiddenBookId() {
        return hiddenBookIdCache.computeIfAbsent("hidden", k -> {
            List<Book> hidden = bookRepository.findByShortNameIn(HIDDEN_BOOK_SHORT_NAMES);
            return hidden.isEmpty() ? null : hidden.get(0).getId();
        });
    }

    // ============ 队列查询 ============

    public ReviewQueueResponse getDueQueue() {
        UUID uid = userId();
        Integer hiddenId = hiddenBookId();
        Instant now = Instant.now();

        List<ReviewCardProjection> dueRows = progressRepository.findDueCards(
                currentUser.getUserId(), now, hiddenId, DUE_LIMIT);

        int remaining = PAGE_LIMIT - dueRows.size();
        List<ReviewCardProjection> newRows = remaining > 0
                ? progressRepository.findNewCards(currentUser.getUserId(), hiddenId, remaining)
                : List.of();

        List<ReviewItemDto> items = new ArrayList<>(dueRows.size() + newRows.size());
        for (ReviewCardProjection p : dueRows) {
            items.add(new ReviewItemDto(toCardDto(p), toProgress(p)));
        }
        for (ReviewCardProjection p : newRows) {
            items.add(new ReviewItemDto(toCardDto(p), null));
        }

        return new ReviewQueueResponse(items, currentUser.getUserId(), items.size(), dueRows.size(), newRows.size());
    }

    // ============ 在计划内查询（结算页预显"已加入"）============

    /**
     * 查询给定词表里哪些已在当前用户的复习计划中（任意 card 有进度即算）。
     * 与「加入复习」用同一 userId 解析，确保结算页"已加入"态与实际可加入状态一致。
     */
    public InPlanWordsResponse getWordsInPlan(List<String> words) {
        List<String> cleaned = words == null ? List.of()
                : words.stream()
                    .filter(w -> w != null && !w.isBlank())
                    .map(String::trim)
                    .distinct()
                    .toList();
        if (cleaned.isEmpty()) {
            return new InPlanWordsResponse(currentUser.getUserId(), List.of());
        }
        List<String> inPlan = progressRepository.findWordsInPlan(currentUser.getUserId(), cleaned);
        return new InPlanWordsResponse(currentUser.getUserId(), inPlan);
    }

    /**
     * 按给定词批量查字典富字段，组装成 ReviewCardDto（前端 WordCard 直接消费）。
     * 用于结算页词卡预取：进入 finished 阶段一次性拉本局全部词，点开即有完整数据。
     */
    public List<ReviewCardDto> getWordsDetail(List<String> words) {
        List<String> cleaned = words == null ? List.of()
                : words.stream()
                    .filter(w -> w != null && !w.isBlank())
                    .map(String::trim)
                    .distinct()
                    .toList();
        if (cleaned.isEmpty()) return List.of();
        List<ReviewCardProjection> rows = progressRepository.findCardsByWords(cleaned);
        List<ReviewCardDto> dtos = new ArrayList<>(rows.size());
        for (ReviewCardProjection p : rows) {
            dtos.add(toCardDto(p));
        }
        return dtos;
    }

    // ============ 评分提交 ============

    public ReviewRatingResponse submitRating(ReviewRatingRequest req) {
        UUID cardId = UUID.fromString(req.cardId());
        Card card = cardRepository.findById(cardId)
                .orElseThrow(() -> new EntityNotFoundException("Card not found: " + req.cardId()));

        Optional<UserCardProgress> existingOpt = progressRepository.findByUserIdAndCardId(userId(), cardId);
        UserCardProgress existing = existingOpt.orElse(null);
        int rating = req.rating();

        FsrsCalculator.Result result = FsrsCalculator.calculate(existing, rating);

        if (existing != null) {
            existing.setFsrsState(result.state());
            existing.setFsrsStability(Double.toString(result.stability()));
            existing.setFsrsDifficulty(Double.toString(result.difficulty()));
            existing.setFsrsLastReviewedAt(Instant.now());
            existing.setFsrsScheduledDays((int) Math.round(result.interval()));
            existing.setFsrsDueDate(result.due());
            existing.setTotalReviews((existing.getTotalReviews() == null ? 0 : existing.getTotalReviews()) + 1);
            existing.setTotalLapses((existing.getTotalLapses() == null ? 0 : existing.getTotalLapses()) + (rating == 0 ? 1 : 0));
            existing.setTotalCorrect((existing.getTotalCorrect() == null ? 0 : existing.getTotalCorrect()) + (rating >= 2 ? 1 : 0));
            progressRepository.save(existing);
        } else {
            UserCardProgress p = new UserCardProgress();
            p.setId(FsrsCalculator.newProgressId());
            p.setUserId(userId());
            p.setCardId(cardId);
            p.setFsrsState(result.state());
            p.setFsrsStability(Double.toString(result.stability()));
            p.setFsrsDifficulty(Double.toString(result.difficulty()));
            p.setFsrsLastReviewedAt(Instant.now());
            p.setFsrsScheduledDays((int) Math.round(result.interval()));
            p.setFsrsDueDate(result.due());
            p.setTotalReviews(1);
            p.setTotalLapses(rating == 0 ? 1 : 0);
            p.setTotalCorrect(rating >= 2 ? 1 : 0);
            progressRepository.save(p);
        }

        // 评分 = 复习一个单词，记入每日统计 + 连续/总天数
        studyStatsService.recordStudy(userId(), 0, 1);

        return new ReviewRatingResponse(
                true,
                result.due().toString(),
                (int) Math.round(result.interval()),
                result.stability(),
                result.difficulty()
        );
    }

    // ============ 加入复习计划（闯关页调用）============

    /**
     * 把一个 word 加入复习计划。mode: wrong(答错自动, lapses+1) / manual(手动, 不扣 lapses)。
     * 与 actions/review-plan.ts 的 addWordToReviewPlan 一致。
     * 返回状态：added / reactivated / already-due / not-found。
     */
    public String addWordToReviewPlan(AddToReviewRequest req) {
        String word = req.word() == null ? "" : req.word().trim();
        if (word.isEmpty()) return "not-found";

        boolean wrong = "wrong".equalsIgnoreCase(req.mode());
        Card card = cardRepository.findFirstByWord(word).orElse(null);
        if (card == null) return "not-found";

        // 按「词」查已有进度：同一词可能分属多本词书（多个 card_id），任取一条复用，
        // 而非按 findFirstByWord 选中的 card 查，避免同词重复建进度、复习队列里重复出题。
        Optional<UserCardProgress> existingOpt = progressRepository.findFirstByUserIdAndWord(currentUser.getUserId(), word);
        Instant now = Instant.now();

        if (existingOpt.isEmpty()) {
            UserCardProgress p = new UserCardProgress();
            p.setId(FsrsCalculator.newProgressId());
            p.setUserId(userId());
            p.setCardId(card.getId());
            p.setFsrsState("learning");
            p.setFsrsStability("0");
            p.setFsrsDifficulty(Integer.toString(card.getDifficulty() == null ? 1 : card.getDifficulty()));
            p.setFsrsDueDate(now);
            p.setFsrsScheduledDays(0);
            p.setTotalReviews(0);
            p.setTotalLapses(wrong ? 1 : 0);
            p.setTotalCorrect(0);
            progressRepository.save(p);
            return "added";
        }

        UserCardProgress existing = existingOpt.get();
        boolean alreadyDue = existing.getFsrsDueDate() != null && !existing.getFsrsDueDate().isAfter(now);
        if (alreadyDue && !wrong) {
            return "already-due";
        }

        existing.setFsrsState("learning");
        existing.setFsrsDueDate(now);
        existing.setFsrsScheduledDays(0);
        if (wrong) {
            existing.setTotalLapses((existing.getTotalLapses() == null ? 0 : existing.getTotalLapses()) + 1);
        }
        progressRepository.save(existing);
        return "reactivated";
    }

    // ============ 熟记 ============

    /**
     * 标记单词为已熟记：写入 user_mastered_words（幂等）+ 删除 user_card_progress。
     * 与 actions/review-plan.ts 的 masterWord 一致。
     */
    public void masterWord(MasterWordRequest req) {
        String word = req.word() == null ? "" : req.word().trim();
        if (word.isEmpty()) return;

        UUID uid = userId();
        if (masteredRepository.findByUserIdAndWord(uid, word).isEmpty()) {
            UserMasteredWord m = new UserMasteredWord();
            m.setId(UUID.randomUUID());
            m.setUserId(uid);
            m.setWord(word);
            masteredRepository.save(m);
        }

        // 按词删除该用户全部复习进度（同一词可能跨多本词书存在多条 card 进度），
        // 确保任何 card 上的进度都被移除，而非仅删 findFirstByWord 选中的那一张。
        progressRepository.deleteByUserIdAndWord(currentUser.getUserId(), word);
    }

    // ============ 投影 -> DTO ============

    private ReviewCardDto toCardDto(ReviewCardProjection p) {
        List<ExampleDto> examples = jsonb.parse(p.getExamples(), EX);
        List<DefinitionDto> defs = jsonb.parse(p.getDefinitions(), DEFS);
        List<FormDto> forms = jsonb.parse(p.getForms(), FORMS);
        List<CollocationDto> cols = jsonb.parse(p.getCollocations(), COLS);
        List<com.wordbattle.lesson.dto.ConfusableDto> conf = jsonb.parse(p.getConfusable(), CONF);

        return new ReviewCardDto(
                p.getCardId() != null ? p.getCardId().toString() : null,
                p.getWord(),
                p.getIpa(),
                p.getTranslation(),
                examples != null && !examples.isEmpty() ? examples.get(0).text() : null,
                p.getAudioUrl(),
                toList(p.getTags()),
                p.getDifficulty(),
                defs,
                examples,
                p.getEtymology(),
                forms,
                toList(p.getSynonyms()),
                toList(p.getAntonyms()),
                toList(p.getRelated()),
                p.getFrequency(),
                p.getDiscrimination(),
                cols,
                conf
        );
    }

    private static List<String> toList(String[] arr) {
        return arr == null ? null : List.of(arr);
    }

    private ProgressDto toProgress(ReviewCardProjection p) {
        if (p.getFsrsDueDate() == null) return null;
        return new ProgressDto(
                p.getFsrsDueDate().toString(),
                p.getTotalReviews(),
                p.getTotalCorrect()
        );
    }
}
