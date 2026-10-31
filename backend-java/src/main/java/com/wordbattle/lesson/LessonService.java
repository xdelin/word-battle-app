package com.wordbattle.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.wordbattle.course.Lesson;
import com.wordbattle.course.LessonRepository;
import com.wordbattle.lesson.dto.CardDto;
import com.wordbattle.lesson.dto.CollocationDto;
import com.wordbattle.lesson.dto.ConfusableDto;
import com.wordbattle.lesson.dto.DefinitionDto;
import com.wordbattle.lesson.dto.ExampleDto;
import com.wordbattle.lesson.dto.FormDto;
import com.wordbattle.lesson.dto.LessonDetailResponse;
import com.wordbattle.lesson.dto.OptionDto;
import com.wordbattle.lesson.dto.QuestionDto;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 关卡详情组装。1:1 复刻前端 lesson 页：
 *   lesson -> challenges(ordered) -> options(ordered)
 *   -> 提取每题单词 -> 批量查 cards / dictionary -> 组装 card
 */
@Service
@Transactional(readOnly = true)
public class LessonService {

    private static final Pattern CN_QUESTION = Pattern.compile("^(.+?)\\s*的中文意思是？$");

    private static final TypeReference<List<DefinitionDto>> DEFS = new TypeReference<>() {};
    private static final TypeReference<List<ExampleDto>> EX = new TypeReference<>() {};
    private static final TypeReference<List<FormDto>> FORMS = new TypeReference<>() {};
    private static final TypeReference<List<CollocationDto>> COLS = new TypeReference<>() {};
    private static final TypeReference<List<ConfusableDto>> CONF = new TypeReference<>() {};

    // 英文释义提取逻辑已移至 EnDefExtractor（学习页与 PK 共用）

    private final LessonRepository lessonRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeOptionRepository optionRepository;
    private final CardRepository cardRepository;
    private final DictionaryRepository dictionaryRepository;
    private final JsonbHelper jsonb;

    public LessonService(LessonRepository lessonRepository,
                         ChallengeRepository challengeRepository,
                         ChallengeOptionRepository optionRepository,
                         CardRepository cardRepository,
                         DictionaryRepository dictionaryRepository,
                         JsonbHelper jsonb) {
        this.lessonRepository = lessonRepository;
        this.challengeRepository = challengeRepository;
        this.optionRepository = optionRepository;
        this.cardRepository = cardRepository;
        this.dictionaryRepository = dictionaryRepository;
        this.jsonb = jsonb;
    }

    public LessonDetailResponse getLessonDetail(Integer lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new EntityNotFoundException("关卡不存在: " + lessonId));

        List<Challenge> challenges = challengeRepository.findByLessonIdOrderByOrderAsc(lessonId);
        List<Integer> challengeIds = challenges.stream().map(Challenge::getId).toList();

        // 批量取所有选项，按 challengeId 分组（保持顺序）
        Map<Integer, List<ChallengeOption>> optionsByChallenge = new HashMap<>();
        if (!challengeIds.isEmpty()) {
            List<ChallengeOption> allOptions = optionRepository.findByChallengeIdInOrderByOrderAsc(challengeIds);
            for (ChallengeOption opt : allOptions) {
                optionsByChallenge.computeIfAbsent(opt.getChallengeId(), k -> new java.util.ArrayList<>()).add(opt);
            }
        }

        // 提取每题对应的英文单词
        List<String> perQuestionWord = challenges.stream()
                .map(ch -> extractWord(ch, optionsByChallenge.getOrDefault(ch.getId(), List.of())))
                .toList();
        Set<String> wordsNeeded = new java.util.LinkedHashSet<>();
        for (String w : perQuestionWord) {
            if (w != null && !w.isBlank()) wordsNeeded.add(w);
        }

        // 批量查 cards / dictionary
        Map<String, Card> cardByWord = new HashMap<>();
        Map<String, Dictionary> dictByWord = new HashMap<>();
        if (!wordsNeeded.isEmpty()) {
            List<String> wordList = List.copyOf(wordsNeeded);
            for (Card c : cardRepository.findByWordIn(wordList)) {
                cardByWord.putIfAbsent(c.getWord(), c);
            }
            for (Dictionary d : dictionaryRepository.findByWordIn(wordList)) {
                dictByWord.put(d.getWord(), d);
            }
        }

        // 批量预加载所有混淆词的 dictionary（干扰项配英文释义用，避免逐个查 N+1）
        Map<String, List<ConfusableDto>> confListByWord = new HashMap<>();
        Set<String> confusableWords = new java.util.LinkedHashSet<>();
        for (String w : perQuestionWord) {
            Dictionary d = w != null ? dictByWord.get(w) : null;
            List<ConfusableDto> cl = d != null ? jsonb.parse(d.getConfusable(), CONF) : null;
            confListByWord.put(w, cl);
            if (cl != null) {
                for (ConfusableDto c : cl) {
                    if (c.word() != null && !c.word().isBlank()) confusableWords.add(c.word());
                }
            }
        }
        Map<String, Dictionary> confDictByWord = new HashMap<>();
        if (!confusableWords.isEmpty()) {
            for (Dictionary d : dictionaryRepository.findByWordIn(List.copyOf(confusableWords))) {
                confDictByWord.put(d.getWord(), d);
            }
        }

        List<QuestionDto> questions = new java.util.ArrayList<>(challenges.size());
        for (int i = 0; i < challenges.size(); i++) {
            Challenge ch = challenges.get(i);
            String word = perQuestionWord.get(i);
            Card card = word != null ? cardByWord.get(word) : null;
            Dictionary dict = word != null ? dictByWord.get(word) : null;

            // 选项顺序随机打乱（防止用户记位置）+ 填充英文释义
            List<OptionDto> optionDtos = new java.util.ArrayList<>();
            List<ConfusableDto> confList = confListByWord.get(word);
            for (ChallengeOption o : optionsByChallenge.getOrDefault(ch.getId(), List.of())) {
                String optText = o.getText();
                String cnPos = EnDefExtractor.extractPosFromText(optText); // 从中文释义提取词性前缀
                String optWord = null;
                String enDef = null;
                if (o.getIsCorrect() != null && o.getIsCorrect()) {
                    // 正确项：题目词
                    optWord = word;
                    enDef = EnDefExtractor.extractEnDefinition(dict, cnPos, jsonb);
                } else if (confList != null) {
                    // 干扰项：按 text 匹配 confusable 的 meaning -> 找 word（用预加载的 confDictByWord）
                    for (ConfusableDto c : confList) {
                        if (c.meaning() != null && c.meaning().equals(optText)) {
                            optWord = c.word();
                            Dictionary confDict = optWord != null ? confDictByWord.get(optWord) : null;
                            enDef = EnDefExtractor.extractEnDefinition(confDict, cnPos, jsonb);
                            break;
                        }
                    }
                    // 兜底1：该混淆词没英文释义，优先用同题其他有 definitions 的混淆词的英文释义
                    if (enDef == null) {
                        for (ConfusableDto c : confList) {
                            if (c.word() == null || c.word().equals(optWord)) continue;
                            Dictionary d2 = confDictByWord.get(c.word());
                            if (d2 != null && d2.getDefinitions() != null && !d2.getDefinitions().isBlank()) {
                                enDef = EnDefExtractor.extractEnDefinition(d2, cnPos, jsonb);
                                break;
                            }
                        }
                    }
                    // 兜底2：整题混淆词都没英文释义，随机抽一个有 definitions 的词的英文释义
                    if (enDef == null) {
                        Dictionary rand = dictionaryRepository.findRandomWithDefinitions().orElse(null);
                        enDef = EnDefExtractor.extractEnDefinition(rand, cnPos, jsonb);
                    }
                }
                optionDtos.add(new OptionDto(o.getId(), optText, o.getIsCorrect(), optWord, enDef));
            }
            java.util.Collections.shuffle(optionDtos);

            questions.add(new QuestionDto(
                    ch.getId(),
                    ch.getId(),
                    ch.getType(),
                    ch.getQuestion(),
                    optionDtos,
                    buildCard(word, dict, card)
            ));
        }

        return new LessonDetailResponse(lesson.getId(), lesson.getTitle(), lesson.getDescription(), questions);
    }

    /** 从题目里提取对应的英文单词（与前端 extractWord 一致）。 */
    private String extractWord(Challenge ch, List<ChallengeOption> options) {
        if ("SELECT_WORD".equals(ch.getType())) {
            for (ChallengeOption o : options) {
                if (Boolean.TRUE.equals(o.getIsCorrect()) && o.getText() != null) {
                    return o.getText().trim();
                }
            }
        }
        if (ch.getQuestion() != null) {
            Matcher m = CN_QUESTION.matcher(ch.getQuestion());
            if (m.find()) return m.group(1).trim();
        }
        return null;
    }

    /** 组装单词卡（与前端 lesson 页组装逻辑一致：dict 优先，card 兜底 word/tags/difficulty）。 */
    private CardDto buildCard(String word, Dictionary dict, Card card) {
        if (dict == null && card == null) return null;

        List<ExampleDto> examples = dict != null ? jsonb.parse(dict.getExamples(), EX) : null;
        List<DefinitionDto> defs = dict != null ? jsonb.parse(dict.getDefinitions(), DEFS) : null;
        List<FormDto> forms = dict != null ? jsonb.parse(dict.getForms(), FORMS) : null;
        List<CollocationDto> cols = dict != null ? jsonb.parse(dict.getCollocations(), COLS) : null;
        List<ConfusableDto> conf = dict != null ? jsonb.parse(dict.getConfusable(), CONF) : null;

        String cardWord = dict != null && dict.getWord() != null ? dict.getWord()
                : (word != null ? word : (card != null ? card.getWord() : ""));

        return new CardDto(
                cardWord,
                dict != null ? dict.getIpa() : null,
                dict != null ? dict.getTranslation() : null,
                examples != null && !examples.isEmpty() ? examples.get(0).text() : null,
                examples,
                dict != null ? dict.getAudioUrl() : null,
                card != null ? card.getTags() : null,
                card != null ? card.getDifficulty() : null,
                defs,
                dict != null ? dict.getEtymology() : null,
                forms,
                dict != null ? dict.getSynonyms() : null,
                dict != null ? dict.getAntonyms() : null,
                dict != null ? dict.getRelated() : null,
                dict != null ? dict.getFrequency() : null,
                dict != null ? dict.getDiscrimination() : null,
                cols,
                conf
        );
    }
}
