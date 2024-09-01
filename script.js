// script.js
document.addEventListener('DOMContentLoaded', function() {
    const startPaymentButton = document.getElementById('start-payment');
    const paymentContainer = document.getElementById('payment-container');

    // Fake quiz data for demonstration
    const quizQuestions = [
        { question: "What is 2 + 2?", options: ["3", "4", "5"], answer: "4" },
        { question: "What is 5 - 3?", options: ["1", "2", "3"], answer: "2" }
    ];

    const quizForm = document.getElementById('quiz-form');

    // Load quiz questions
    quizQuestions.forEach((q, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('question');
        questionElement.innerHTML = `
            <p>${index + 1}. ${q.question}</p>
            ${q.options.map((option, i) => `
                <label>
                    <input type="radio" name="question${index}" value="${option}" required>
                    ${option}
                </label>
            `).join('<br>')}
        `;
        quizForm.appendChild(questionElement);
    });

    startPaymentButton.addEventListener('click', function() {
        paymentContainer.style.display = 'block';
        document.getElementById('quiz-container').style.display = 'none';
    });

    // Stripe integration
    const stripe = Stripe('your-publishable-key-here'); // Replace with your Stripe publishable key
    const elements = stripe.elements();
    const card = elements.create('card');
    card.mount('#card-element');

    document.getElementById('payment-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const {token, error} = await stripe.createToken(card);

        if (error) {
            console.error(error);
            alert('Payment failed!');
        } else {
            // Send token to your server
            fetch('/charge', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({token: token.id})
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Payment successful!');
                    // Redirect or show success message
                } else {
                    alert('Payment failed!');
                }
            });
        }
    });
});
