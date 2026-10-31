package com.wordbattle.pk;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.wordbattle.lesson.EnDefExtractor;
import com.wordbattle.lesson.JsonbHelper;
import com.wordbattle.pk.dto.CreateRoomRequest;
import com.wordbattle.pk.dto.JoinRoomRequest;
import com.wordbattle.pk.dto.NpcSubmitResponse;
import com.wordbattle.pk.dto.PkOptionDto;
import com.wordbattle.pk.dto.PkOptionsPayload;
import com.wordbattle.pk.dto.PkQuestionDto;
import com.wordbattle.pk.dto.PkRoomAnswerDto;
import com.wordbattle.pk.dto.PkRoomDetailDto;
import com.wordbattle.pk.dto.PkRoomDto;
import com.wordbattle.pk.dto.PkRoomUserDto;
import com.wordbattle.pk.dto.SideResult;
import com.wordbattle.pk.dto.StartNpcRequest;
import com.wordbattle.pk.dto.SubmitAnswerRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * PK 服务。1:1 复刻 actions/pk-actions.ts：
 *   createRoom / joinRoom / startGame / submitAnswer(真人) /
 *   startNpcGame / submitNpcAnswer(NPC 模拟) / endGame / getRoom / getRoomAnswers。
 *
 * 注意：pk_room_questions.options 为 jsonb 字符串（双层编码），写入时把 List<String>
 * 序列化为 "[\"a\",\"b\"]" 字符串再存，与 TS 端 Drizzle 行为一致。
 */
@Service
@Transactional
public class PkService {

    private static final int DEFAULT_QUESTION_COUNT = 10;
    private static final int DEFAULT_TIME_PER_Q = 10;

    private final PkRoomRepository roomRepository;
    private final PkRoomUserRepository roomUserRepository;
    private final PkRoomQuestionRepository questionRepository;
    private final PkUserAnswerRepository answerRepository;
    private final PkUserEnsure userEnsure;
    private final LeaderboardService leaderboard;
    private final PkSocketHandler pkSocket;
    private final ObjectMapper objectMapper;
    private final JsonbHelper jsonb;
    private final EntityManager em;

    public PkService(PkRoomRepository roomRepository,
                     PkRoomUserRepository roomUserRepository,
                     PkRoomQuestionRepository questionRepository,
                     PkUserAnswerRepository answerRepository,
                     PkUserEnsure userEnsure,
                     LeaderboardService leaderboard,
                     PkSocketHandler pkSocket,
                     ObjectMapper objectMapper,
                     JsonbHelper jsonb,
                     EntityManager em) {
        this.roomRepository = roomRepository;
        this.roomUserRepository = roomUserRepository;
        this.questionRepository = questionRepository;
        this.answerRepository = answerRepository;
        this.userEnsure = userEnsure;
        this.leaderboard = leaderboard;
        this.pkSocket = pkSocket;
        this.objectMapper = objectMapper;
        this.jsonb = jsonb;
        this.em = em;
    }

    // ============ 创建房间 ============

    public PkRoomDto createRoom(CreateRoomRequest req) {
        userEnsure.ensurePlayer(req.userId(), req.userName());
        String type = req.type() == null ? "friend" : req.type();
        int questionCount = req.questionCount() == null ? DEFAULT_QUESTION_COUNT : req.questionCount();
        int timePerQuestion = req.timePerQuestion() == null ? DEFAULT_TIME_PER_Q : req.timePerQuestion();

        // 生成不重复房间码
        String roomCode = generateUniqueRoomCode();

        PkRoom room = new PkRoom();
        room.setId(UUID.randomUUID());
        room.setRoomCode(roomCode);
        room.setType(type);
        room.setStatus("waiting");
        room.setBookId(req.bookId());
        room.setQuestionCount(questionCount);
        room.setTimePerQuestion(timePerQuestion);
        roomRepository.save(room);

        // 房主加入
        PkRoomUser host = new PkRoomUser();
        host.setId(UUID.randomUUID());
        host.setRoomId(room.getId());
        host.setUserId(UUID.fromString(req.userId()));
        host.setIsHost(true);
        host.setIsReady("npc".equals(type));
        host.setSeatNo(0);
        host.setTotalScore(0);
        host.setCorrectCount(0);
        host.setQuestionIndex(0);
        host.setConnectedAt(Instant.now());
        roomUserRepository.save(host);

        return toRoomDto(room);
    }

    // ============ 加入房间 ============

    public PkRoomDto joinRoom(JoinRoomRequest req) {
        userEnsure.ensurePlayer(req.userId(), req.userName());
        // 悲观锁锁房间行直到事务提交：并发 join 串行化后，人数检查才可靠
        PkRoom room = roomRepository.findByRoomCodeForUpdate(req.roomCode())
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
        if (!"waiting".equals(room.getStatus())) {
            throw new IllegalArgumentException("Room is not available");
        }
        UUID userId = UUID.fromString(req.userId());
        if (roomUserRepository.findByRoomIdAndUserId(room.getId(), userId).isPresent()) {
            throw new IllegalArgumentException("Already in room");
        }
        List<PkRoomUser> users = roomUserRepository.findByRoomId(room.getId());
        if (users.size() >= 2) {
            throw new IllegalArgumentException("Room is full");
        }

        PkRoomUser guest = new PkRoomUser();
        guest.setId(UUID.randomUUID());
        guest.setRoomId(room.getId());
        guest.setUserId(userId);
        guest.setIsHost(false);
        guest.setIsReady(true);
        guest.setSeatNo(users.size());
        guest.setTotalScore(0);
        guest.setCorrectCount(0);
        guest.setQuestionIndex(0);
        guest.setConnectedAt(Instant.now());
        roomUserRepository.save(guest);

        if (users.size() + 1 == 2) {
            room.setStatus("ready");
            roomRepository.save(room);
        }
        return toRoomDto(room);
    }

    // ============ 开始对战（真人，房主）============

    public List<PkQuestionDto> startGame(String userId, String roomIdStr) {
        UUID roomId = UUID.fromString(roomIdStr);
        UUID uid = UUID.fromString(userId);
        PkRoomUser host = roomUserRepository.findByRoomIdAndUserId(roomId, uid)
                .orElseThrow(() -> new IllegalArgumentException("Not in room"));
        if (!Boolean.TRUE.equals(host.getIsHost())) {
            throw new IllegalArgumentException("Not authorized to start game");
        }
        PkRoom room = roomRepository.findById(roomId)
                .orElseThrow(() -> new EntityNotFoundException("Room not found"));
        if (!"ready".equals(room.getStatus())) {
            throw new IllegalArgumentException("Room is not ready");
        }
        List<PkQuestionDto> questions = generateQuestions(room.getId(), room.getBookId(), room.getQuestionCount());
        if (questions.isEmpty()) {
            throw new IllegalStateException("Failed to generate questions");
        }
        room.setStatus("playing");
        room.setStartedAt(Instant.now());
        roomRepository.save(room);
        return questions;
    }

    // ============ 提交答案（真人对战）============

    public SideResult submitAnswer(SubmitAnswerRequest req) {
        UUID questionId = UUID.fromString(req.questionId());
        PkRoomQuestion q = questionRepository.findById(questionId)
                .orElseThrow(() -> new EntityNotFoundException("Question not found"));
        UUID userId = UUID.fromString(req.userId());

        if (answerRepository.findByUserIdAndQuestionId(userId, questionId).isPresent()) {
            throw new IllegalArgumentException("Already answered");
        }
        int timeSpent = req.timeSpent() == null ? 0 : req.timeSpent();
        int tpMs = q.getRoomId() != null ? getTimePerQuestionMs(q.getRoomId()) : DEFAULT_TIME_PER_Q * 1000;
        boolean isCorrect = req.selectedOption() != null && req.selectedOption().equals(q.getCorrectIndex());
        int timeLeft = tpMs - Math.min(timeSpent, tpMs);
        int score = isCorrect ? PkUtils.calculatePKScore(timeLeft, tpMs) : -10;

        saveAnswer(req.userId(), req.roomId(), req.questionId(), req.selectedOption(), isCorrect, timeSpent, score);
        roomUserRepository.addScore(req.roomId(), req.userId(), score, isCorrect ? 1 : 0);
        // WebSocket 推送对手"已作答"（前端收到后立即拉取，轮询作降级）。
        // 必须等事务提交后再推：否则前端立即轮询会读到提交前的旧数据。
        String roomIdStr = req.roomId();
        String questionIdStr = req.questionId();
        String userIdStr = req.userId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    pkSocket.notifyOpponentAnswered(roomIdStr, questionIdStr, userIdStr);
                }
            });
        } else {
            pkSocket.notifyOpponentAnswered(roomIdStr, questionIdStr, userIdStr);
        }

        return new SideResult(isCorrect, score, timeSpent);
    }

    private int getTimePerQuestionMs(UUID roomId) {
        return roomRepository.findById(roomId)
                .map(r -> (r.getTimePerQuestion() == null ? DEFAULT_TIME_PER_Q : r.getTimePerQuestion()) * 1000)
                .orElse(DEFAULT_TIME_PER_Q * 1000);
    }

    private void saveAnswer(String userId, String roomId, String questionId, Integer selectedOption,
                            boolean isCorrect, int timeSpent, int score) {
        PkUserAnswer a = new PkUserAnswer();
        a.setId(UUID.randomUUID());
        a.setRoomId(UUID.fromString(roomId));
        a.setUserId(UUID.fromString(userId));
        a.setQuestionId(UUID.fromString(questionId));
        a.setSelectedOption(selectedOption);
        a.setIsCorrect(isCorrect);
        a.setTimeSpent(timeSpent);
        a.setScore(score);
        a.setAnsweredAt(Instant.now());
        answerRepository.save(a);
    }

    // ============ NPC 对战 ============

    public com.wordbattle.pk.dto.StartNpcResponse startNpcGame(StartNpcRequest req) {
        userEnsure.ensurePlayer(req.userId(), req.userName());
        userEnsure.ensureNpc();
        int questionCount = req.questionCount() == null ? DEFAULT_QUESTION_COUNT : req.questionCount();
        int timePerQuestion = req.timePerQuestion() == null ? DEFAULT_TIME_PER_Q : req.timePerQuestion();

        String roomCode = generateUniqueRoomCode();
        PkRoom room = new PkRoom();
        room.setId(UUID.randomUUID());
        room.setRoomCode(roomCode);
        room.setType("npc");
        room.setStatus("playing");
        room.setBookId(req.bookId());
        room.setQuestionCount(questionCount);
        room.setTimePerQuestion(timePerQuestion);
        room.setStartedAt(Instant.now());
        roomRepository.save(room);

        // 房主 + NPC
        UUID uid = UUID.fromString(req.userId());
        Instant now = Instant.now();
        PkRoomUser host = newRoomUser(room.getId(), uid, true, true, now, 0);
        PkRoomUser npc = newRoomUser(room.getId(), UUID.fromString(PkUtils.NPC_USER_ID), false, true, now, 1);
        roomUserRepository.saveAll(List.of(host, npc));

        List<PkQuestionDto> questions = generateQuestions(room.getId(), room.getBookId(), questionCount);
        if (questions.isEmpty()) {
            throw new IllegalStateException("Failed to generate questions");
        }
        return new com.wordbattle.pk.dto.StartNpcResponse(toRoomDto(room), PkUtils.NPC_USER_ID, PkUtils.NPC_USER_NAME, questions);
    }

    private PkRoomUser newRoomUser(UUID roomId, UUID userId, boolean host, boolean ready, Instant now, int seatNo) {
        PkRoomUser u = new PkRoomUser();
        u.setId(UUID.randomUUID());
        u.setRoomId(roomId);
        u.setUserId(userId);
        u.setIsHost(host);
        u.setIsReady(ready);
        u.setSeatNo(seatNo);
        u.setTotalScore(0);
        u.setCorrectCount(0);
        u.setQuestionIndex(0);
        u.setConnectedAt(now);
        return u;
    }

    /** NPC 模拟答题：用户落库 + NPC 同步生成答案。 */
    public NpcSubmitResponse submitNpcAnswer(SubmitAnswerRequest req) {
        UUID questionId = UUID.fromString(req.questionId());
        PkRoomQuestion q = questionRepository.findById(questionId)
                .orElseThrow(() -> new EntityNotFoundException("Question not found"));
        PkRoom room = roomRepository.findById(UUID.fromString(req.roomId()))
                .orElseThrow(() -> new EntityNotFoundException("Room not found"));
        int tpMs = (room.getTimePerQuestion() == null ? DEFAULT_TIME_PER_Q : room.getTimePerQuestion()) * 1000;

        UUID userId = UUID.fromString(req.userId());
        int userTimeSpent = req.timeSpent() == null ? 0 : req.timeSpent();

        // 用户答案（幂等）
        Optional<PkUserAnswer> existingUser = answerRepository.findByUserIdAndQuestionId(userId, questionId);
        boolean userIsCorrect;
        int userScore;
        if (existingUser.isEmpty()) {
            userIsCorrect = req.selectedOption() != null && req.selectedOption().equals(q.getCorrectIndex());
            int userTimeLeft = tpMs - Math.min(userTimeSpent, tpMs);
            userScore = userIsCorrect ? PkUtils.calculatePKScore(userTimeLeft, tpMs) : -10;
            saveAnswer(req.userId(), req.roomId(), req.questionId(), req.selectedOption(), userIsCorrect, userTimeSpent, userScore);
            roomUserRepository.addScore(req.roomId(), req.userId(), userScore, userIsCorrect ? 1 : 0);
        } else {
            userIsCorrect = Boolean.TRUE.equals(existingUser.get().getIsCorrect());
            userScore = existingUser.get().getScore();
        }

        // NPC 答案（幂等）
        UUID npcId = UUID.fromString(PkUtils.NPC_USER_ID);
        Optional<PkUserAnswer> existingNpc = answerRepository.findByUserIdAndQuestionId(npcId, questionId);
        boolean npcIsCorrect;
        int npcScore;
        int npcTimeMs;
        if (existingNpc.isEmpty()) {
            npcIsCorrect = Math.random() < PkUtils.NPC_CORRECT_RATE;
            int delay = PkUtils.NPC_MIN_DELAY_MS + (int)(Math.random() * (PkUtils.NPC_MAX_DELAY_MS - PkUtils.NPC_MIN_DELAY_MS));
            npcTimeMs = Math.min(tpMs, Math.max(userTimeSpent + 200, delay));
            int npcTimeLeft = tpMs - Math.min(npcTimeMs, tpMs);
            npcScore = npcIsCorrect ? PkUtils.calculatePKScore(npcTimeLeft, tpMs) : -10;
            PkOptionsPayload payload = parseOptions(q.getOptions());
            int optCount = payload.options().isEmpty() ? 4 : payload.options().size();
            int npcSelected = npcIsCorrect ? q.getCorrectIndex()
                    : (q.getCorrectIndex() + 1 + (int)(Math.random() * 3)) % optCount;
            saveAnswer(PkUtils.NPC_USER_ID, req.roomId(), req.questionId(), npcSelected, npcIsCorrect, Math.round(npcTimeMs), npcScore);
            roomUserRepository.addScore(req.roomId(), PkUtils.NPC_USER_ID, npcScore, npcIsCorrect ? 1 : 0);
        } else {
            PkUserAnswer a = existingNpc.get();
            npcIsCorrect = Boolean.TRUE.equals(a.getIsCorrect());
            npcScore = a.getScore();
            npcTimeMs = a.getTimeSpent() == null ? 0 : a.getTimeSpent();
        }

        return new NpcSubmitResponse(
                new SideResult(userIsCorrect, userScore, userTimeSpent),
                new SideResult(npcIsCorrect, npcScore, npcTimeMs),
                q.getCorrectIndex()
        );
    }

    // ============ 结束游戏 ============

    public void endGame(String roomIdStr) {
        UUID roomId = UUID.fromString(roomIdStr);
        List<PkRoomUser> users = roomUserRepository.findByRoomId(roomId);
        if (users.size() == 2) {
            PkRoomUser u1 = users.get(0);
            PkRoomUser u2 = users.get(1);
            PkRoomUser winner = u1.getTotalScore() > u2.getTotalScore() ? u1 : u2;
            PkRoomUser loser = u1.getTotalScore() > u2.getTotalScore() ? u2 : u1;
            int winnerRank = updateElo(winner.getUserId(), loser.getUserId(), true);
            int loserRank = updateElo(loser.getUserId(), winner.getUserId(), false);
            leaderboard.recordRank(winner.getUserId().toString(), fetchUserName(winner.getUserId()), winnerRank);
            leaderboard.recordRank(loser.getUserId().toString(), fetchUserName(loser.getUserId()), loserRank);
        }
        PkRoom room = roomRepository.findById(roomId).orElse(null);
        if (room != null) {
            room.setStatus("finished");
            room.setFinishedAt(Instant.now());
            roomRepository.save(room);
        }
    }

    private String fetchUserName(UUID userId) {
        List<?> rows = em.createNativeQuery("select name from users where id = cast(? as uuid)")
                .setParameter(1, userId.toString())
                .getResultList();
        return rows.isEmpty() ? null : (String) rows.get(0);
    }

    private int updateElo(UUID selfId, UUID opponentId, boolean won) {
        Integer selfRank = (Integer) em.createNativeQuery(
                "select power_word_rank from user_stats where user_id = cast(? as uuid)")
                .setParameter(1, selfId.toString()).getSingleResult();
        Integer oppRank = (Integer) em.createNativeQuery(
                "select power_word_rank from user_stats where user_id = cast(? as uuid)")
                .setParameter(1, opponentId.toString()).getSingleResult();
        if (selfRank == null) selfRank = 1200;
        if (oppRank == null) oppRank = 1200;
        int newRank = PkUtils.calculatePowerWordRank(selfRank, won, oppRank);
        // 更新词力值 + 累加对战场次（胜者再加胜场）
        String sql = won
                ? "update user_stats set power_word_rank = ?, total_games_played = total_games_played + 1, games_won = games_won + 1, updated_at = now() where user_id = cast(? as uuid)"
                : "update user_stats set power_word_rank = ?, total_games_played = total_games_played + 1, updated_at = now() where user_id = cast(? as uuid)";
        em.createNativeQuery(sql)
                .setParameter(1, newRank)
                .setParameter(2, selfId.toString())
                .executeUpdate();
        return newRank;
    }

    // ============ 查询 ============

    @Transactional(readOnly = true)
    public PkRoomDetailDto getRoom(String roomIdStr) {
        UUID roomId = UUID.fromString(roomIdStr);
        PkRoom room = roomRepository.findById(roomId).orElse(null);
        if (room == null) return null;
        List<PkRoomUser> users = roomUserRepository.findByRoomId(roomId);
        List<PkRoomQuestion> questions = questionRepository.findByRoomIdOrderByQuestionIndexAsc(roomId);
        return new PkRoomDetailDto(
                toRoomDto(room),
                users.stream().map(u -> new PkRoomUserDto(
                        u.getUserId().toString(),
                        u.getIsHost(),
                        u.getTotalScore(),
                        u.getCorrectCount())).toList(),
                questions.stream().map(q -> {
                    PkOptionsPayload p = parseOptions(q.getOptions());
                    return new PkQuestionDto(
                            q.getId().toString(),
                            q.getQuestionIndex(),
                            q.getQuestion(),
                            p.options(),
                            q.getCorrectIndex(),
                            p.phonetic());
                }).toList()
        );
    }

    @Transactional(readOnly = true)
    public List<PkRoomAnswerDto> getRoomAnswers(String roomIdStr) {
        UUID roomId = UUID.fromString(roomIdStr);
        return answerRepository.findByRoomIdOrderByAnsweredAtAsc(roomId).stream()
                .map(a -> new PkRoomAnswerDto(
                        a.getUserId().toString(),
                        a.getQuestionId().toString(),
                        a.getScore(),
                        a.getIsCorrect(),
                        a.getSelectedOption(),
                        a.getAnsweredAt() == null ? null : a.getAnsweredAt().toString()))
                .toList();
    }

    // ============ 题目生成 ============

    private List<PkQuestionDto> generateQuestions(UUID roomId, Integer bookId, int questionCount) {
        int poolSize = Math.max(questionCount * 8, 40);
        List<Object[]> rows = questionRepository.findCandidates(bookId, poolSize);
        if (rows.isEmpty()) return List.of();

        List<Candidate> all = rows.stream().map(r -> new Candidate(
                (UUID) r[0],
                r[1] == null ? "" : r[1].toString(),
                r[2] == null ? "" : r[2].toString(),
                parseConfusableDistractors(r[3]),
                r[4] == null ? null : r[4].toString(),
                r[5] == null ? null : r[5].toString()
        )).toList();

        List<Candidate> selected = PkUtils.shuffle(all).subList(0, Math.min(questionCount, all.size()));
        List<PkQuestionDto> result = new ArrayList<>();
        for (int i = 0; i < selected.size(); i++) {
            Candidate cur = selected.get(i);
            String correctText = PkUtils.shortDef(cur.translation());
            String correctEnDef = EnDefExtractor.extractEnDefinition(
                    cur.definitions(), EnDefExtractor.extractPosFromText(correctText), jsonb);

            // 干扰项：从随机候选词取，每项带英文释义（与正确项同构，前端可逐项切换中/英文）
            List<PkOptionDto> wrongOptions = new ArrayList<>();
            Set<String> usedTexts = new HashSet<>();
            usedTexts.add(correctText);
            for (Candidate d : PkUtils.shuffle(all)) {
                if (d.cardId().equals(cur.cardId())) continue;
                String text = PkUtils.shortDef(d.translation());
                if (text.isEmpty() || usedTexts.contains(text)) continue;
                usedTexts.add(text);
                String enDef = EnDefExtractor.extractEnDefinition(
                        d.definitions(), EnDefExtractor.extractPosFromText(text), jsonb);
                wrongOptions.add(new PkOptionDto(text, enDef));
                if (wrongOptions.size() >= 3) break;
            }
            List<PkOptionDto> options = new ArrayList<>();
            options.add(new PkOptionDto(correctText, correctEnDef));
            options.addAll(wrongOptions);
            options = PkUtils.shuffle(options);
            int correctIndex = 0;
            for (int j = 0; j < options.size(); j++) {
                if (options.get(j).text().equals(correctText)) { correctIndex = j; break; }
            }
            String phonetic = cur.ipa();
            UUID questionId = UUID.randomUUID();
            String optionsJson = serializeOptions(new PkOptionsPayload(phonetic, options));

            // 原生 SQL 插入：options 为 jsonb 列，需 cast(:json as jsonb)；
            // 存包装对象 {phonetic, options:[{text, enDefinition}]}，回读时解析。
            em.createNativeQuery("""
                    insert into pk_room_questions (id, room_id, question_index, card_id, question, options, correct_index)
                    values (cast(:id as uuid), cast(:roomId as uuid), :idx, cast(:cardId as uuid), :question, cast(:options as jsonb), :correctIndex)
                    """)
                    .setParameter("id", questionId.toString())
                    .setParameter("roomId", roomId.toString())
                    .setParameter("idx", i)
                    .setParameter("cardId", cur.cardId().toString())
                    .setParameter("question", cur.word())
                    .setParameter("options", optionsJson)
                    .setParameter("correctIndex", correctIndex)
                    .executeUpdate();

            result.add(new PkQuestionDto(questionId.toString(), i, cur.word(), options, correctIndex, phonetic));
        }
        return result;
    }

    /** 题目候选词内部表示。definitions/ipa 用于配选项英文释义与题干音标。 */
    private record Candidate(UUID cardId, String word, String translation,
                             List<String> confusableDistractors, String definitions, String ipa) {
    }

    // ============ jsonb options 序列化/反序列化 ============

    /** 解析 confusable jsonb 字符串成 meaning 列表（用于干扰项）。 */
    @SuppressWarnings("unchecked")
    private List<String> parseConfusableDistractors(Object raw) {
        if (raw == null) return List.of();
        try {
            // raw 是 confusable::text，可能是双层编码字符串或直接 JSON
            String json = raw.toString();
            com.fasterxml.jackson.databind.JsonNode node = objectMapper.readTree(json);
            if (node.isTextual()) {
                node = objectMapper.readTree(node.asText()); // 双层编码
            }
            List<String> out = new ArrayList<>();
            for (com.fasterxml.jackson.databind.JsonNode item : node) {
                String meaning = item.path("meaning").asText("");
                if (!meaning.isEmpty()) out.add(meaning);
            }
            return out;
        } catch (Exception e) {
            return List.of();
        }
    }

    /** PkOptionsPayload -> JSON 字符串（存入 options jsonb 列）。 */
    private String serializeOptions(PkOptionsPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"phonetic\":null,\"options\":[]}";
        }
    }

    /** options jsonb 文本 -> PkOptionsPayload（含 phonetic + 选项列表）。旧数据/解析失败返回空。 */
    private PkOptionsPayload parseOptions(String raw) {
        PkOptionsPayload p = jsonb.parse(raw, new TypeReference<PkOptionsPayload>() {});
        return p == null ? new PkOptionsPayload(null, List.of()) : p;
    }

    private List<String> join(String head, List<String> rest) {
        List<String> all = new ArrayList<>(rest.size() + 1);
        all.add(head);
        all.addAll(rest);
        return all;
    }

    private String generateUniqueRoomCode() {
        for (int i = 0; i < 10; i++) {
            String code = PkUtils.generateRoomCode();
            if (roomRepository.findByRoomCode(code).isEmpty()) return code;
        }
        return PkUtils.generateRoomCode(); // fallback
    }

    private PkRoomDto toRoomDto(PkRoom r) {
        return new PkRoomDto(
                r.getId().toString(),
                r.getRoomCode(),
                r.getType(),
                r.getStatus(),
                r.getBookId(),
                r.getQuestionCount(),
                r.getTimePerQuestion(),
                r.getStartedAt()
        );
    }
}
