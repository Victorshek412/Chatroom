import express from "express";
import { signup, login, logout } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup", signup);

router.post("/login", login);
// why use post for login and signup instead of get?
// POST is used for login and signup because these operations involve sending sensitive information (like passwords) in the request body.
// Using POST helps to keep this information out of the URL, which can be logged or cached, enhancing security.
// Additionally, POST requests are designed for actions that change server state (like creating a new user), whereas GET requests are intended for retrieving data without side effects.

router.post("/logout", logout);

export default router; // Export the router to be used in other parts of the application
