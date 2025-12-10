/* script.js 전체 코드 (안전장치 포함) */

/* ==========================================================
   [기능 추가] 새로고침 감지 및 메인으로 이동 / 닫기 버튼
   ========================================================== */
if (window.performance && window.performance.getEntriesByType("navigation").length > 0) {
    const navType = window.performance.getEntriesByType("navigation")[0].type;
    if (navType === 'reload') {
        window.location.href = '../index.html';
    }
} else {
    if (window.performance.navigation.type === 1) {
        window.location.href = '../index.html';
    }
}

function goMain() {
    window.location.href = '../index.html';
}

lucide.createIcons();

const audioPlayer = new Audio();
let currentStep = 0; 
let maxSteps = 1;    

/* ==========================================================
   [기능 추가] UI 잠금 제어 함수
   ========================================================== */
function setUILock(lock) {
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
        if (lock) {
            contentArea.classList.add('ui-locked');
        } else {
            contentArea.classList.remove('ui-locked');
        }
    }
}

/* ==========================================================
   [설정] 각 페이지/단계별 대지시문 음원 경로
   ========================================================== */
const guideAudioList = {
    'intro': { 0: "audio/c_intro.mp3" },
    'vocab': { 0: "audio/audio_0.mp3", 1: "audio/vocab_guide_1.mp3" },
    'read': { 0: "audio/audio_16.mp3", 1: "audio/audio_15.mp3" },
    'structure': { 0: "audio/audio_18.mp3", 1: "audio/audio_11.mp3", 2: "audio/audio_12.mp3", 3: "audio/audio_13.mp3" },
    'write': { 0: "audio/audio_14.mp3" },
    'outro': { 0: "audio/outro.mp3" }
};

function playPageGuide(stepIdx) {
    const audioEl = document.getElementById('guide-audio');
    if (audioEl && guideAudioList[pageName] && guideAudioList[pageName][stepIdx]) {
        const filePath = guideAudioList[pageName][stepIdx];
        if (filePath) {
            audioEl.src = filePath;
            audioEl.play().catch(e => console.log("자동 재생 차단됨:", e));
        }
    }
}

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

    if (pageName === 'intro' || pageName === 'index') {
        setTimeout(() => { playAudio('audio/audio_00.mp3'); }, 1000);
        setTimeout(() => { playAudio('https://actions.google.com/sounds/v1/cartoon/pop_ding.ogg'); }, 2200);
    }

    // [수정] 가이드 오디오 이벤트 리스너 (잠금/해제)
    const guideAudioEl = document.getElementById('guide-audio');
    if (guideAudioEl) {
        guideAudioEl.addEventListener('play', () => setUILock(true));
        guideAudioEl.addEventListener('ended', () => setUILock(false));
        guideAudioEl.addEventListener('pause', () => setUILock(false));
        // 에러 발생 시에도 잠금 해제
        guideAudioEl.addEventListener('error', () => setUILock(false));
    }

    // [추가] 안전장치: 화면 클릭 시 오디오가 안 나오고 있다면 강제 잠금 해제
    // (오디오가 끝났는데도 JS가 꼬여서 잠겨있는 경우 방지)
    document.addEventListener('click', () => {
        const guide = document.getElementById('guide-audio');
        // 메인 오디오와 가이드 오디오 둘 다 멈춰있으면 잠금 해제
        if (audioPlayer.paused && (!guide || guide.paused)) {
            setUILock(false);
        }
    });

    if (pageName === 'vocab') {
        setTimeout(() => {
            if(typeof showHanjaGuide === 'function') showHanjaGuide();
        }, 1000);
        showVocabCard(1); 
        initGameElements(); 
    }

    setTimeout(() => {
        playPageGuide(0); 
    }, 500); 
}

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

// [수정] playAudio 함수 (잠금 기능 포함)
function playAudio(src, callback, lockUI = true) {
    if (lockUI) setUILock(true);

    audioPlayer.src = src;
    audioPlayer.play().catch(e => {
        console.log("Audio play prevented:", e);
        if (lockUI) setUILock(false);
    });

    audioPlayer.onended = () => {
        if (lockUI) setUILock(false);
        if (callback) callback();
    };
    
    // 오디오 멈추면 잠금 해제 (일시정지 포함)
    audioPlayer.onpause = () => { if(lockUI && !audioPlayer.ended) setUILock(false); };
    audioPlayer.onerror = () => { if(lockUI) setUILock(false); };
}

function changeStep(direction) {
    if(audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    const guideAudioEl = document.getElementById('guide-audio');
    if(guideAudioEl) {
        guideAudioEl.pause();
        guideAudioEl.currentTime = 0;
    }

    setUILock(false); // 단계 이동 시 무조건 잠금 해제

    const nextStepIndex = currentStep + direction;

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
        playPageGuide(nextStepIndex); 
 
        if (pageName === 'read' && currentStep === 1) {
            setTimeout(showQuizFinger, 100);
        }

        if (pageName === 'vocab' && currentStep === 1) {
            if(typeof handleScaling === 'function') handleScaling();
            if(typeof resetGame === 'function') resetGame();
            if (typeof audioIntro !== 'undefined' && audioIntro) {
                audioIntro.play().catch(()=>{});
            }
        }
    } 
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

function handleScaling() { }

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

function revealKeySentence() {
    document.getElementById('key-bubble').style.display = 'block';
    const textContainer = document.getElementById('passage-text');
    if(textContainer) {
        textContainer.scrollTo({ top: textContainer.scrollHeight, behavior: 'smooth' });
    }
    const nextBtn = document.getElementById('next-btn');
    if(nextBtn) nextBtn.disabled = true;
    playAudio('audio/audio_17.mp3', () => {
        if(nextBtn) {
            nextBtn.disabled = false; 
        }
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
        setTimeout(() => {
            const stamp = document.getElementById('stamp-complete');
            if(stamp) stamp.classList.add('show');
        }, 500);
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

// [쓰기랑] 입력 체크
function checkWriting(area) {
    const btn = document.getElementById('write-done-btn');
    if(btn) {
        // 글자가 있으면 disabled를 푼다 (false)
        btn.disabled = (area.value.trim().length === 0);
    }
}

function finishWriting() {
    const nextBtn = document.getElementById('next-btn');
    if(nextBtn) {
        nextBtn.disabled = false;
        const stamp = document.getElementById('stamp-complete');
        if(stamp) stamp.classList.add('show');
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

function toggleCpDrop(btn) {
    document.querySelectorAll('.cp-dropdown-list').forEach(el => {
        if(el !== btn.nextElementSibling) el.classList.remove('show');
    });
    btn.nextElementSibling.classList.toggle('show');
}

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
                    const stamp = document.getElementById('stamp-complete');
                    if(stamp) stamp.classList.add('show');
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

const globalClickSound = new Audio('audio/click.mp3'); 
document.addEventListener('click', function(e) {
    const target = e.target.closest('button, a, .tab-btn, .nav-btn, .option-item, .hanja-reveal, .circle-btn, .start-btn, .replay-btn, .vocab-arrow-btn, .def-content, .ex-answer-box, .check-box, .sentence-wrapper');
    if (target && !target.disabled && !target.classList.contains('disabled')) {
        globalClickSound.currentTime = 0; 
        globalClickSound.play().catch(() => {}); 
    }
});

function showQuizFinger() {
    const finger = document.getElementById('read-quiz-finger');
    const firstOption = document.querySelector('#read-screen .option-item');
    if (finger && firstOption) {
        const rect = firstOption.getBoundingClientRect();
        finger.style.left = (rect.right - 50 + window.scrollX) + 'px'; 
        finger.style.top = (rect.top + 20 + window.scrollY) + 'px';
        finger.style.display = 'block';
        setTimeout(() => {
            finger.style.display = 'none';
        }, 1500);
    }
}

window.addEventListener('resize', handleScaling);
init();
