// script.js
document.addEventListener('DOMContentLoaded', function () {

    // ──────────────────────────────────────────────
    // Quiz data
    // ──────────────────────────────────────────────
    const quizQuestions = [
        {
            question: "Which AWS service is used to store objects in the cloud?",
            options: ["EC2", "S3", "RDS", "Lambda"],
            answer: "S3"
        },
        {
            question: "What does CPU stand for?",
            options: ["Central Processing Unit", "Core Processing Unit", "Central Program Utility", "Compute Processing Unit"],
            answer: "Central Processing Unit"
        },
        {
            question: "Which protocol is used to securely transfer files?",
            options: ["FTP", "HTTP", "SFTP", "SMTP"],
            answer: "SFTP"
        },
        {
            question: "What is 2 + 2?",
            options: ["3", "4", "5", "6"],
            answer: "4"
        },
        {
            question: "What is the default port for HTTPS?",
            options: ["80", "443", "8080", "22"],
            answer: "443"
        }
    ];

    // ──────────────────────────────────────────────
    // Timer configuration (seconds)
    // ──────────────────────────────────────────────
    const EXAM_DURATION_SECONDS = 30 * 60; // 30 minutes
    let timerInterval = null;
    let secondsRemaining = EXAM_DURATION_SECONDS;

    // ──────────────────────────────────────────────
    // Element references
    // ──────────────────────────────────────────────
    const signinContainer    = document.getElementById('signin-container');
    const quizView           = document.getElementById('quiz-view');
    const signinForm         = document.getElementById('signin-form');
    const signinError        = document.getElementById('signin-error');
    const guestBtn           = document.getElementById('guest-btn');
    const signoutBtn         = document.getElementById('signout-btn');
    const userDisplay        = document.getElementById('user-display');
    const timerDisplay       = document.getElementById('timer-display');
    const quizForm           = document.getElementById('quiz-form');
    const startPaymentBtn    = document.getElementById('start-payment');
    const paymentContainer   = document.getElementById('payment-container');
    const resultsContainer   = document.getElementById('results-container');
    const resultsScore       = document.getElementById('results-score');
    const retakeBtn          = document.getElementById('retake-btn');
    const proceedPaymentBtn  = document.getElementById('proceed-payment-btn');

    // ──────────────────────────────────────────────
    // Sign-In logic
    // ──────────────────────────────────────────────
    signinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const email    = document.getElementById('signin-email').value.trim();
        const password = document.getElementById('signin-password').value;

        if (!email || !password) {
            showSigninError('Please enter your email and password.');
            return;
        }

        // Demo authentication: accept any non-empty credentials
        startQuiz(email);
    });

    guestBtn.addEventListener('click', function () {
        startQuiz('Guest');
    });

    signoutBtn.addEventListener('click', function () {
        stopTimer();
        secondsRemaining = EXAM_DURATION_SECONDS;
        quizView.style.display = 'none';
        signinContainer.style.display = 'flex';
        paymentContainer.style.display = 'none';
        resultsContainer.style.display = 'none';
        document.getElementById('quiz-container').style.display = 'block';
    });

    function showSigninError(msg) {
        signinError.textContent = msg;
        signinError.style.display = 'block';
    }

    // ──────────────────────────────────────────────
    // Start quiz session
    // ──────────────────────────────────────────────
    function startQuiz(username) {
        signinContainer.style.display = 'none';
        quizView.style.display = 'block';
        userDisplay.textContent = username === 'Guest' ? 'Guest' : username;
        signinError.style.display = 'none';

        renderQuiz();
        startTimer();
    }

    // ──────────────────────────────────────────────
    // Render quiz questions
    // ──────────────────────────────────────────────
    function renderQuiz() {
        quizForm.innerHTML = '';
        quizQuestions.forEach(function (q, index) {
            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question');
            questionDiv.innerHTML =
                '<p class="question-text"><strong>' + (index + 1) + '.</strong> ' + q.question + '</p>' +
                q.options.map(function (option) {
                    return '<label class="option-label">' +
                        '<input type="radio" name="question' + index + '" value="' + option + '" required>' +
                        '<span>' + option + '</span>' +
                        '</label>';
                }).join('');
            quizForm.appendChild(questionDiv);
        });
    }

    // ──────────────────────────────────────────────
    // Timer logic
    // ──────────────────────────────────────────────
    function startTimer() {
        secondsRemaining = EXAM_DURATION_SECONDS;
        updateTimerDisplay();
        timerInterval = setInterval(function () {
            secondsRemaining--;
            updateTimerDisplay();
            if (secondsRemaining <= 0) {
                stopTimer();
                alert('\u23F0 Time is up! Your quiz has been automatically submitted.');
                submitQuiz();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        const mins = Math.floor(secondsRemaining / 60);
        const secs = secondsRemaining % 60;
        timerDisplay.textContent =
            String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

        if (secondsRemaining <= 300) {
            timerDisplay.classList.add('timer-warning');
        } else {
            timerDisplay.classList.remove('timer-warning');
        }
    }

    // ──────────────────────────────────────────────
    // Quiz submission & scoring
    // ──────────────────────────────────────────────
    startPaymentBtn.addEventListener('click', function () {
        submitQuiz();
    });

    function submitQuiz() {
        stopTimer();

        var score = 0;
        quizQuestions.forEach(function (q, index) {
            var selected = quizForm.querySelector('input[name="question' + index + '"]:checked');
            if (selected && selected.value === q.answer) {
                score++;
            }
        });

        var total = quizQuestions.length;
        var pct   = Math.round((score / total) * 100);

        document.getElementById('quiz-container').style.display = 'none';
        resultsContainer.style.display = 'block';
        resultsScore.innerHTML =
            'You scored <strong>' + score + ' / ' + total + '</strong> (' + pct + '%)';
    }

    retakeBtn.addEventListener('click', function () {
        resultsContainer.style.display = 'none';
        document.getElementById('quiz-container').style.display = 'block';
        renderQuiz();
        startTimer();
    });

    proceedPaymentBtn.addEventListener('click', function () {
        resultsContainer.style.display = 'none';
        paymentContainer.style.display = 'block';
    });

    // ──────────────────────────────────────────────
    // Stripe payment integration
    // ──────────────────────────────────────────────
    var stripe   = Stripe('your-publishable-key-here'); // Replace with your Stripe publishable key
    var elements = stripe.elements();
    var card     = elements.create('card');
    card.mount('#card-element');

    document.getElementById('payment-form').addEventListener('submit', function (event) {
        event.preventDefault();
        stripe.createToken(card).then(function (result) {
            if (result.error) {
                console.error(result.error);
                alert('Payment failed: ' + result.error.message);
            } else {
                fetch('/charge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: result.token.id })
                })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data.success) {
                        alert('\uD83C\uDF89 Payment successful! You now have full access.');
                    } else {
                        alert('Payment failed. Please try again.');
                    }
                });
            }
        });
    });
});
