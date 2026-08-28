# CSRF protection

Cookie-authenticated clients first call `GET /v1/auth/csrf`. The response contains a token and sets an HTTP-only CSRF secret cookie. Every unsafe authentication request (`register`, `login`, and `logout`) must send that token in the `X-CSRF-Token` header together with the cookie. Requests without a valid token receive `403`.
