# Ride Angels — SMS opt-in disclosure

This page documents how Ride Angels obtains consent to send SMS one-time
passcodes (OTP) for account authentication (Twilio Verify / Auth OTP).

## Product

**Ride Angels** (`org.rideangels.app`) — iOS and Android app for coordinating
trusted rides to appointments.

## How users opt in

1. The user opens Ride Angels and chooses **Create account** or **Sign in** with phone.
2. They enter **their own** mobile number in the app.
3. They tap **Continue** (or equivalent). That action requests a one-time SMS
   code from Ride Angels / Hyperion App Studio via Twilio.
4. No marketing or promotional SMS is sent. Messages are transactional OTP only.
5. Standard message and data rates may apply.
6. To stop messages: reply **STOP**. For help: reply **HELP**.

Consent is collected only when the user voluntarily submits their number in the
authenticated app flow. Phone numbers are not purchased or scraped.

## Sample message

```text
Your Ride Angels code is: 123456
```

## Contact

- Studio: [Hyperion App Studio](https://hyperionappstudio.com)
- Verification / support contact: looking@devincoopers.space
- Toll-free sender (after verification): +1 (855) 970-5852
