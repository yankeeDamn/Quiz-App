// server.js
const express = require('express');
const stripe = require('stripe')('your-secret-key-here'); // Replace with your Stripe secret key
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());
app.use(express.static('public')); // Assuming your HTML, CSS, and JS files are in 'public' directory

app.post('/charge', async (req, res) => {
    const {token} = req.body;

    try {
        const charge = await stripe.charges.create({
            amount: 5000, // Amount in cents
            currency: 'usd',
            description: 'Quiz Payment',
            source: token,
        });

        res.json({success: true});
    } catch (error) {
        res.json({success: false});
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
