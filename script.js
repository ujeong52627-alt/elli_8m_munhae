/* ==========================================================
   [기능 추가] 새로고침 감지 및 메인으로 이동 / 닫기 버튼
   ========================================================== */

// 1. 새로고침 감지 -> 메인으로 강제 이동
if (window.performance && window.performance.getEntriesByType("navigation").length > 0) {
    const navType = window.performance.getEntriesByType("navigation")[0].type;
    // 'reload'는 새로고침, 'back_forward'는 뒤로가기로 진입 시
    if (navType === 'reload') {
        window.location.href = '../index.html';
    }
} else {
    // 구형 브라우저 호환 (performance API 미지원 시)
    if (window.performance.navigation.type === 1) {
        window.location.href = '../index.html';
    }
}

// 2. 메인으로 돌아가기 함수 (X버튼 클릭 시)
function goMain() {
    window.location.href = '../index.html';
}

lucide.createIcons();

const audioPlayer = new Audio();
let currentStep = 0; 
let maxSteps = 1;    

/* ==========================================================
   [설정] 각 페이지/단계별 대지시문 음원 경로
   ========================================================== */
const guideAudioList = {

      // 0. 인트로 (0단계)
    'intro': {
        0: "audio/c_intro.mp3", // 기존 init에서 틀던 파일
    },

    // 1. 어휘랑 (0단계: 학습, 1단계: 게임)
    'vocab': {
        0: "audio/audio_0.mp3", // 기존 init에서 틀던 파일
        1: "audio/vocab_guide_1.mp3"  // 게임 단계용 파일 (있다면)
    },
    // 2. 읽기랑 (0단계: 지문, 1단계: 퀴즈)
    'read': {
        0: "audio/audio_16.mp3",  // 예: "경복이의 의미를 생각하며..."
        1: "audio/audio_15.mp3"   // 예: "질문에 알맞은 답을..."
    },
    // 3. 구조랑 (0단계: 표지, 1~3단계: 학습)
    'structure': {
        0: "audio/audio_18.mp3", // (필요 없으면 비워도 됨)
        1: "audio/audio_11.mp3", // "빈칸을 눌러 상징에 대해..."
        2: "audio/audio_12.mp3", // "빈칸에 알맞은 말을 찾아..."
        3: "audio/audio_13.mp3"  // "제시된 의미를 상징하는..."
    },
    // 4. 쓰기랑 (0단계)
    'write': {
        0: "audio/audio_14.mp3"   // "주제를 한 문장으로 써 봅시다."
    },

    // 5. 아웃트로 (0단계)
    'outro': {
        0: "audio/outro.mp3" 
    }
};

// [기능] 해당 단계의 오디오 재생 함수
function playPageGuide(stepIdx) {
    const audioEl = document.getElementById('guide-audio');
    // 현재 페이지 이름(pageName)과 단계(stepIdx)에 맞는 파일 찾기
    if (audioEl && guideAudioList[pageName] && guideAudioList[pageName][stepIdx]) {
        const filePath = guideAudioList[pageName][stepIdx];
        
        // 경로가 있을 때만 재생
        if (filePath) {
            audioEl.src = filePath;
            audioEl.play().catch(e => console.log("자동 재생 차단됨(사용자 클릭 필요):", e));
        }
    }
} 

// [설정] vocab: 2단계 (카드 -> 게임)
const pageConfig = {
    'vocab': { steps: 2, next: 'read.html', prev: 'intro.html' },
    'read': { steps: 2, next: 'structure.html', prev: 'vocab.html' },
    'structure': { steps: 4, next: 'write.html', prev: 'read.html' },
    'write': { steps: 1, next: 'outro.html', prev: 'structure.html' },
    'intro': { steps: 1, next: 'vocab.html', prev: null },
    'outro': { steps: 1, next: 'intro.html', prev: 'write.html' }
};

let pathName = window.location.pathname.split("/").pop();
if (pathName === "" || pathName === "index.html") pathName = "intro.html";
const pageName = pathName.replace(".html", "");

// 게임 관련 변수
let isGameActive = true; 
let audioIntro, audioCorrect, audioWrong, audioClickCorrect, audioClickWrong, audioComplete;
let introPlayedOnce = false;
let introFinished = false;
let stampComplete;
let rewardShown = false;
let fingerGuideEl; 
let fingerGuideShown = false;
const ATTACK_DELAY = 700; 
const REACTION_DELAY = 200; 
const WRONG_RESET_DELAY = 700;

function init() {
    console.log("Current Page:", pageName);

    if (pageConfig[pageName]) {
        maxSteps = pageConfig[pageName].steps;
        resetStepVisibility();
        updateNavUI();
    }

    // 인트로 페이지 효과음
    if (pageName === 'intro' || pageName === 'index') {
        setTimeout(() => { playAudio('audio/audio_00.mp3'); }, 1000);
        setTimeout(() => { playAudio('https://actions.google.com/sounds/v1/cartoon/pop_ding.ogg'); }, 2200);
    }

    // [수정됨] 어휘랑 페이지 초기화 (충돌 해결)
    if (pageName === 'vocab') {
        // 기존: playAudio('audio/audio_0.mp3', showHanjaGuide); -> 삭제함 (playPageGuide가 대신 함)
        
        // 손가락 가이드는 오디오와 상관없이 1초 뒤에 보여줌
        setTimeout(() => {
            if(typeof showHanjaGuide === 'function') showHanjaGuide();
        }, 1000);

        showVocabCard(1); 
        initGameElements(); 
    }

    // [추가] 모든 페이지 공통: 처음 들어왔을 때 0단계 오디오 자동 재생
    setTimeout(() => {
        playPageGuide(0); 
    }, 500); 
}

// 스텝 초기화
function resetStepVisibility() {
    const startIdx = 0; 
    for(let i=0; i<10; i++) {
        const el = document.getElementById(`${pageName}-step-${i}`);
        if(el) el.style.display = 'none';
    }
    const firstEl = document.getElementById(`${pageName}-step-${startIdx}`);
    if(firstEl) firstEl.style.display = 'flex';
    
    if (pageName === 'vocab') handleScaling(); 
    
    currentStep = 0; 
}

function playAudio(src, callback) {
    audioPlayer.src = src;
    audioPlayer.play().catch(e => console.log("Audio play prevented:", e));
    if (callback) {
        audioPlayer.onended = callback;
    } else {
        audioPlayer.onended = null;
    }
}

// --- 네비게이션 및 단계 이동 ---

// [수정됨] 단계 이동 함수 (오디오 제어 포함)
function changeStep(direction) {
    
    // [추가] 단계 이동 시, 기존에 떠들던 오디오(단어 읽기 등) 강제 정지
    if(audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }

    const nextStepIndex = currentStep + direction;

    // A. 페이지 내 다음 단계 이동
    if (nextStepIndex >= 0 && nextStepIndex < maxSteps) {
        const currentEl = document.getElementById(`${pageName}-step-${currentStep}`);
        if (currentEl) currentEl.style.display = 'none';

        const nextEl = document.getElementById(`${pageName}-step-${nextStepIndex}`);
        if (nextEl) {
            nextEl.style.display = 'flex';
            window.scrollTo(0, 0); 
        }
        
        currentStep = nextStepIndex;
        updateNavUI();

        // [추가] 단계가 바뀌면 해당 단계 오디오 재생
        playPageGuide(nextStepIndex); 
 
// 읽기랑 퀴즈 단계(1단계) 진입 시 손가락 가이드 보여주기
        if (pageName === 'read' && currentStep === 1) {
            setTimeout(showQuizFinger, 100);
        }

        // 어휘랑(vocab) 2단계(게임) 진입 시 게임 리셋
        if (pageName === 'vocab' && currentStep === 1) {
            if(typeof handleScaling === 'function') handleScaling();
            if(typeof resetGame === 'function') resetGame();
            if (typeof audioIntro !== 'undefined' && audioIntro) {
                audioIntro.play().catch(()=>{});
            }
        }
    } 
    // B. 다음/이전 페이지로 이동
    else {
        if (direction > 0 && pageConfig[pageName].next) {
            location.href = pageConfig[pageName].next;
        } else if (direction < 0 && pageConfig[pageName].prev) {
            location.href = pageConfig[pageName].prev;
        }
    }
}

function updateNavUI() {
    const dotsContainer = document.getElementById('dots-container');
    const nextBtn = document.getElementById('next-btn');
    const navControls = document.querySelector('.nav-controls');
    
    if (dotsContainer) {
        dotsContainer.innerHTML = '';
        const displayCount = (pageName === 'structure') ? maxSteps - 1 : maxSteps; 
        
        for(let i=0; i < displayCount; i++) {
            const dot = document.createElement('div');
            let isActive = (i === currentStep);
            if(pageName === 'structure') isActive = (i === currentStep - 1);
            
            dot.className = `dot ${isActive ? 'active' : ''}`;
            
            if (!(pageName === 'structure' && currentStep === 0)) {
                dotsContainer.appendChild(dot);
            }
        }
    }
    
    if (nextBtn) {
        if (pageName === 'vocab' || pageName === 'read' || pageName === 'structure' || pageName === 'write') {
            nextBtn.disabled = true;
        } else {
            nextBtn.disabled = false;
        }
    }
    
    if (pageName === 'structure' && currentStep === 0) {
        if(navControls) navControls.style.display = 'none'; 
    } else {
        if(navControls) navControls.style.display = 'flex';
    }
}

// --- [어휘랑 1단계: 단어 카드] ---

let currentVocabCard = 1;
function showVocabCard(index) {
    document.querySelectorAll('.vocab-card').forEach(c => c.style.display = 'none');
    const target = document.getElementById(`vocab-card-${index}`);
    if(target) target.style.display = 'flex';
    
    const star1 = document.getElementById('header-star-1');
    const star2 = document.getElementById('header-star-2');
    if(star1) star1.src = index >= 1 ? 'imgs/star_on.png' : 'imgs/star_off.png';
    if(star2) star2.src = index >= 2 ? 'imgs/star_on.png' : 'imgs/star_off.png';

    const doneContainer = document.getElementById('vocab-done-container');
    if (index === 2 && doneContainer) {
        doneContainer.style.display = 'flex';
        const revealedCount = document.querySelectorAll(`#vocab-card-2 .hanja-reveal.revealed`).length;
        document.getElementById('vocab-done-btn').disabled = (revealedCount < 2);
    } else if(doneContainer) {
        doneContainer.style.display = 'none';
    }
}
function nextVocabCard() { if(currentVocabCard < 2) showVocabCard(++currentVocabCard); }
function prevVocabCard() { if(currentVocabCard > 1) showVocabCard(--currentVocabCard); }

function reveal(el, text, idx, audio) {
    if (el.classList.contains('revealed')) return;

    el.textContent = text;
    el.classList.add('revealed');

    const cardId = `vocab-card-${idx}`;
    const totalBlanks = document.querySelectorAll(`#${cardId} .hanja-reveal`).length;
    const revealedBlanks = document.querySelectorAll(`#${cardId} .hanja-reveal.revealed`).length;

    if (revealedBlanks === totalBlanks) {
        let sequenceList = [];
        if (idx === 1) { 
            sequenceList = ['audio/audio_1.mp3', 'audio/audio_4.mp3', 'audio/audio_5.mp3'];
        } else if (idx === 2) { 
            sequenceList = ['audio/audio_6.mp3', 'audio/audio_9.mp3', 'audio/audio_10.mp3'];
        }

        playAudio(audio, () => {
            playAudioSequence(sequenceList);
        });

        if (idx === 2) {
            document.getElementById('vocab-done-btn').disabled = false;
        }
    } else {
        playAudio(audio);
    }
}

// --- [어휘랑 2단계: 몬스터 게임] ---

function initGameElements() {
    audioIntro        = document.getElementById('audio-intro');
    audioCorrect      = document.getElementById('audio-correct');
    audioWrong        = document.getElementById('audio-wrong');
    audioClickCorrect = document.getElementById('audio-click-correct');
    audioClickWrong   = document.getElementById('audio-click-wrong');
    audioComplete     = document.getElementById('audio-complete');
    stampComplete     = document.getElementById('stamp-complete');
    fingerGuideEl     = document.getElementById('finger-guide');

    if (audioIntro) {
        audioIntro.addEventListener('ended', () => {
            introFinished = true;
            setOptionsEnabled(true);
        });
        audioIntro.addEventListener('timeupdate', () => {
            if (!audioIntro.duration) return;
            const remaining = audioIntro.duration - audioIntro.currentTime;
            if (!fingerGuideShown && remaining <= 1 && remaining > 0) {
                showFingerGuide();
            }
        });
    }

    const options = document.querySelectorAll('.option-item');
    options.forEach(option => {
        option.addEventListener('click', function() {
            const selectedWord = this.getAttribute('data-choice');
            handleOptionClick(this, selectedWord);
        });
    });
}

function playAudioSafe(audioObj, resetTime = true) {
    if (!audioObj) return;
    try {
        if (resetTime) audioObj.currentTime = 0;
        audioObj.play().catch(() => {});
    } catch(e) {}
}

function setOptionsEnabled(enabled) {
    document.querySelectorAll('.option-item').forEach(opt => {
        opt.style.pointerEvents = enabled ? 'auto' : 'none';
    });
}

function handleScaling() {
}

function showFingerGuide() {
    if (!fingerGuideEl || fingerGuideShown) return;
    
    const targetBtn = document.getElementById('option-가치'); 
    const appContainer = document.getElementById('app-container'); 

    if (targetBtn && appContainer) {
        const btnRect = targetBtn.getBoundingClientRect();
        const containerRect = appContainer.getBoundingClientRect();

        const newTop = (btnRect.top - containerRect.top) + (btnRect.height / 2);
        const newLeft = (btnRect.left - containerRect.left) + (btnRect.width / 2);

        fingerGuideEl.style.left = `${newLeft}px`;
        fingerGuideEl.style.top = `${newTop}px`;
        fingerGuideEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }
    
    fingerGuideShown = true;
    fingerGuideEl.style.opacity = '1';
    fingerGuideEl.style.transform = 'scale(0.8)';
    fingerGuideEl.style.animation = 'finger-pulse 1s ease-in-out 2';
    fingerGuideEl.addEventListener('animationend', () => {
        fingerGuideEl.style.opacity = '0';
        fingerGuideEl.style.animation = 'none';
    }, { once: true });
}

function showCompletionReward() {
    if (rewardShown) return;
    rewardShown = true;
    setTimeout(() => {
        playAudioSafe(audioComplete);
        if (stampComplete) {
            stampComplete.style.opacity = '1';
            stampComplete.style.transform = 'scale(1)';
        }
        const nextBtn = document.getElementById('next-btn');
        if(nextBtn) nextBtn.disabled = false;
    }, 1700);
}

function resetGame() {
    isGameActive = true;
    rewardShown = false;
    setOptionsEnabled(introFinished);
    
    const learner = document.getElementById('learner');
    const monster = document.getElementById('monster');
    const effect = document.getElementById('effect');
    
    if(learner) {
        learner.classList.remove('char-attack-size');
        learner.classList.add('char-default-size');
        learner.src = 'imgs/learner_default.png';
    }
    if(monster) {
        monster.classList.remove('char-default-size');
        monster.classList.add('char-default-size');
        monster.src = 'imgs/monster_default.png';
    }
    if(effect) {
        effect.style.opacity = '0';
        effect.style.animation = 'none';
    }
    if(stampComplete) stampComplete.style.opacity = '0';

    document.querySelectorAll('.option-item').forEach(o => { 
        o.classList.remove('clicked', 'correct-border', 'wrong-border'); 
        o.style.transform = "scale(1)";
    });
}

function handleOptionClick(selectedElement, selectedWord) {
    if (!isGameActive) return; 

    const answerText = document.getElementById('answer-text');
    const correctWord = answerText.getAttribute('data-correct-answer');

    if (selectedWord === correctWord) {
        playAudioSafe(audioClickCorrect, true);
    } else {
        playAudioSafe(audioClickWrong, true);
    }

    document.querySelectorAll('.option-item').forEach(opt => opt.style.pointerEvents = 'none'); 

    selectedElement.classList.add('clicked');
    if (selectedWord === correctWord) {
        selectedElement.classList.add('correct-border');
    } else {
        selectedElement.classList.add('wrong-border');
    }
    
    if (selectedWord === correctWord) {
        handleCorrect(selectedElement, selectedWord);
    } else {
        handleWrong(selectedElement);
    }
    
    setTimeout(() => { 
        if (selectedWord !== correctWord) {
             selectedElement.classList.remove('clicked', 'correct-border', 'wrong-border'); 
        }
    }, 3000); 
}

function handleCorrect(selectedElement, word) {
    isGameActive = false; 
    
    const blankBox = document.querySelector('.blank-box');
    if(blankBox) {
        blankBox.textContent = word;
        blankBox.classList.add('correct');

        const josaPart = document.getElementById('quiz-josa');
        if (josaPart) {
            josaPart.innerText = '가'; 
        }
    }
    
    setTimeout(() => { playAudioSafe(audioCorrect); }, 1000);

    const learner = document.getElementById('learner');
    const monster = document.getElementById('monster');
    const effect = document.getElementById('effect');

    if(learner) {
        learner.classList.remove('char-default-size');
        learner.classList.add('char-attack-size'); 
        learner.src = 'imgs/learner_attack.png'; 
    }
    
    if(effect) {
        effect.src = 'imgs/effect_learner.png'; 
        effect.style.opacity = '1';
        effect.style.animation = 'attack-to-monster 1s forwards'; 
    }

    setTimeout(() => {
        if(monster) monster.src = 'imgs/monster_wrong.png'; 
        if(effect) { effect.style.animation = 'none'; effect.style.opacity = '0'; }
        
        setTimeout(() => {
            if(learner) {
                learner.classList.remove('char-attack-size'); 
                learner.src = 'imgs/learner_correct.png'; 
            }
            showCompletionReward();
        }, REACTION_DELAY);
    }, ATTACK_DELAY); 
}

function handleWrong(selectedElement) {
    isGameActive = false; 
    setTimeout(() => { playAudioSafe(audioWrong); }, 1000);
    
    const learner = document.getElementById('learner');
    const monster = document.getElementById('monster');
    const effect = document.getElementById('effect');

    if(monster) monster.src = 'imgs/monster_attack.png'; 
    if(effect) {
        effect.src = 'imgs/effect_monster.png'; 
        effect.style.opacity = '1';
        effect.style.animation = 'attack-to-learner 1s forwards'; 
    }
    
    setTimeout(() => {
        if(learner) learner.src = 'imgs/learner_wrong.png'; 
        if(effect) { effect.style.animation = 'none'; effect.style.opacity = '0'; }

        setTimeout(() => {
            resetGame();
        }, WRONG_RESET_DELAY); 
    }, ATTACK_DELAY); 
}

// --- 기타 페이지 (읽기, 구조, 쓰기) 기능 ---


function revealKeySentence() {
    // 1. 말풍선 보이게 하기
    document.getElementById('key-bubble').style.display = 'block';
    
    // 2. 스크롤 내리기
    const textContainer = document.getElementById('passage-text');
    if(textContainer) {
        textContainer.scrollTo({ top: textContainer.scrollHeight, behavior: 'smooth' });
    }

    // 3. [중요] 일단 버튼을 비활성화(못 누르게) 상태로 확실하게 잠금
    const nextBtn = document.getElementById('next-btn');
    if(nextBtn) nextBtn.disabled = true;

    // 4. 오디오 재생 시작
    playAudio('audio/audio_17.mp3', () => {
        
        // 5. [핵심] 오디오가 다 끝난 뒤(Callback)에 이 코드가 실행됨
        if(nextBtn) {
            nextBtn.disabled = false; // 이제 버튼 활성화!
        }
        
        // (기존에 있던 changeStep(1) 자동 이동 코드는 삭제했습니다)
    });
}
function checkQuiz(el, isCorrect) {
    if (document.querySelector('.option-item.correct')) return;

    document.querySelectorAll('.option-item').forEach(i => {
        i.classList.remove('selected', 'wrong');
    });

    el.classList.add('selected');

    if(isCorrect) {
        el.classList.remove('selected'); 
        el.classList.add('correct');     
        
        const explanation = document.getElementById('quiz-explanation');
        if(explanation) {
            explanation.classList.add('show');
            const qBox = document.querySelector('.question-box');
            if(qBox) {
                setTimeout(() => {
                    qBox.scrollTo({ top: qBox.scrollHeight, behavior: 'smooth' });
                }, 100);
            }
        }
        
        playAudio('https://placehold.co/audio_correct.mp3');

        const nextBtn = document.getElementById('next-btn');
        if(nextBtn) nextBtn.disabled = false;

    } else {
        el.classList.add('wrong'); 
        playAudio('https://placehold.co/audio_wrong.mp3');
        
        setTimeout(() => {
            el.classList.remove('wrong');
            el.classList.remove('selected');
        }, 500);
    }
}

function revealConceptDef(el) {
    const ph = el.querySelector('.def-placeholder');
    const txt = el.querySelector('.def-text');
    if(ph) ph.style.display = 'none';
    if(txt) {
        txt.style.display = 'block';
        txt.style.animation = 'fadeIn 0.5s';
        playAudio('https://placehold.co/audio_correct.mp3');
    }
    checkStructStep1();
}

function checkWriting(area) {
    const btn = document.getElementById('write-done-btn');
    if(btn) btn.disabled = (area.value.trim().length === 0);
}

function finishWriting() {
    const nextBtn = document.getElementById('next-btn');
    if(nextBtn) {
        nextBtn.disabled = false;
        const doneBtn = document.getElementById('write-done-btn');
        if(doneBtn) {
            doneBtn.innerText = "완료됨"; 
            doneBtn.disabled = true;      
        }
    }
}


function openModal(type) {
    if(type === 'fulltext') {
        const modal = document.getElementById('text-modal');
        if(modal) {
            modal.classList.add('active'); 
            modal.style.display = 'flex'; 
        }
    } else if(type === 'example') {
        const modal = document.getElementById('example-modal');
        if(modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

/* ==========================================================
   [구조랑] 전용 로직
   ========================================================== */

// Step 1: 예시 카드 열기
function revealEx(element, text) {
    if(element.classList.contains('revealed')) return;
    element.innerHTML = text;
    element.classList.add('revealed');
    playAudio('https://placehold.co/audio_correct.mp3');
    checkStructStep1();
}

function checkStructStep1() {
    const defOpen = document.querySelector('.def-text') && document.querySelector('.def-text').style.display === 'block';
    const exOpen = document.querySelectorAll('.ex-answer-box.revealed').length;
    
    if(defOpen && exOpen >= 3) {
        const nextBtn = document.getElementById('next-btn');
        if(nextBtn) nextBtn.disabled = false;
    }
}

// Step 2: 드롭다운 토글
function toggleCpDrop(btn) {
    document.querySelectorAll('.cp-dropdown-list').forEach(el => {
        if(el !== btn.nextElementSibling) el.classList.remove('show');
    });
    btn.nextElementSibling.classList.toggle('show');
}

// Step 2: 드롭다운 정답 선택
function checkCpAnswer(option, isCorrect, text) {
    const list = option.parentElement;
    const container = list.parentElement; 
    
    list.classList.remove('show');
    
    if(isCorrect) {
        container.querySelector('.cp-dropdown-btn').style.display = 'none';
        container.classList.add('correct');
        container.innerHTML = text; 
        playAudio('https://placehold.co/audio_correct.mp3');
        
        if(document.querySelectorAll('.cp-content.correct').length >= 6) {
            const nextBtn = document.getElementById('next-btn');
            if(nextBtn) nextBtn.disabled = false;
        }
    } else {
        playAudio('https://placehold.co/audio_wrong.mp3');
        container.style.animation = 'shake 0.4s';
        setTimeout(() => container.style.animation = '', 400);
        alert("다시 한 번 생각해보세요!");
    }
}

document.addEventListener('click', e => {
    if(!e.target.closest('.cp-content')) {
        document.querySelectorAll('.cp-dropdown-list').forEach(el => el.classList.remove('show'));
    }
});

// [구조랑 Step 3] 문장 정답 체크 함수
function checkSentence(el, isCorrect) {
    if (el.classList.contains('correct')) return;
    if (el.classList.contains('wrong')) return;

    if (isCorrect) {
        el.classList.add('correct');
        playAudio('audio/clickcorrect.mp3'); 

        const totalCorrect = document.querySelectorAll('.sentence-wrapper.correct').length;
        if (totalCorrect >= 2) {
            const nextBtn = document.getElementById('next-btn');
            if (nextBtn) {
                nextBtn.disabled = false;
                setTimeout(() => {
                    playAudio('audio/complete.mp3'); 
                }, 1000);
            }
        }
    } else {
        el.classList.add('wrong');
        playAudio('audio/clickwrong.mp3');
        setTimeout(() => {
            el.classList.remove('wrong');
        }, 800);
    }
}

function showHanjaGuide() {
    const targetBtn = document.querySelector('#vocab-card-1 .hanja-reveal'); 
    
    if (!targetBtn || targetBtn.classList.contains('revealed')) return;

    const finger = document.getElementById('finger-guide');
    const appContainer = document.getElementById('app-container');

    if (finger && appContainer) {
        const btnRect = targetBtn.getBoundingClientRect();
        const containerRect = appContainer.getBoundingClientRect();

        const newTop = (btnRect.top - containerRect.top) + (btnRect.height / 2);
        const newLeft = (btnRect.left - containerRect.left) + (btnRect.width / 2);

        finger.style.left = `${newLeft}px`;
        finger.style.top = `${newTop}px`;
        finger.style.transform = 'translate(-50%, -50%) scale(0.8)'; 
        finger.style.opacity = '1';
        
        finger.style.animation = 'finger-pulse 1s ease-in-out 2';
        
        finger.addEventListener('animationend', () => {
            finger.style.opacity = '0';
            finger.style.animation = 'none';
        }, { once: true });
    }
}

function playAudioSequence(list, onAllEnded) {
    let index = 0;

    function playNext() {
        if (index >= list.length) {
            if (onAllEnded) onAllEnded(); 
            return;
        }

        playAudio(list[index], () => {
            index++;     
            playNext();  
        });
    }

    playNext();
}

/* ==========================================================
   [전체 공통] 모든 클릭 가능한 요소 공통 효과음 재생
   ========================================================== */
const globalClickSound = new Audio('audio/click.mp3'); // 경로 확인 필요

document.addEventListener('click', function(e) {
    // 1. 클릭된 요소가 '누를 수 있는 대상'인지 확인 (가장 가까운 부모 요소를 찾음)
    // button, a 태그 및 우리가 만든 각종 버튼 클래스들을 모두 포함
    const target = e.target.closest('button, a, .tab-btn, .nav-btn, .option-item, .hanja-reveal, .circle-btn, .start-btn, .replay-btn, .vocab-arrow-btn, .def-content, .ex-answer-box, .check-box, .sentence-wrapper');

    // 2. 타겟이 확인되었고, '비활성화(disabled)' 상태가 아니라면 소리 재생
    if (target && !target.disabled && !target.classList.contains('disabled')) {
        
        // 소리 끊김 방지 (연타 시 바로 다시 재생)
        globalClickSound.currentTime = 0; 
        
        // 재생 (브라우저 에러 방지용 catch 포함)
        globalClickSound.play().catch(() => {}); 
    }
});

// [추가] 퀴즈 손가락 가이드 띄우기 함수
function showQuizFinger() {
    const finger = document.getElementById('read-quiz-finger');
    // 읽기랑 화면의 첫 번째 선택지 찾기
    const firstOption = document.querySelector('#read-screen .option-item');

    if (finger && firstOption) {
        // 1. 첫 번째 선택지의 위치 정보 가져오기
        const rect = firstOption.getBoundingClientRect();

        // 2. 손가락 위치 설정 (선택지의 오른쪽 끝 부분에 걸치게)
        // 화면 스크롤 위치(window.scrollX/Y)까지 고려하여 정확한 위치 계산
        finger.style.left = (rect.right - 50 + window.scrollX) + 'px'; 
        finger.style.top = (rect.top + 20 + window.scrollY) + 'px';

        // 3. 손가락 보이기
        finger.style.display = 'block';

        // 4. 3초 뒤에 자동으로 숨기기
        setTimeout(() => {
            finger.style.display = 'none';
        }, 1500);
    }
}



window.addEventListener('resize', handleScaling);
init();

