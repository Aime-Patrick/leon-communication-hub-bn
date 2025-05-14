"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessagesByPhoneNumber = exports.getMessages = exports.sendWhatsAppMessage = exports.receiveMessage = exports.verifyWebhook = void 0;
const whatsapp_service_1 = require("../../../service/whatsapp.service");
const whatsappMessage_model_1 = __importDefault(require("../../../models/whatsappMessage.model"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (!mode || !token || !challenge) {
        res.sendStatus(400);
    }
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ Webhook verified!");
        res.status(200).send(challenge);
    }
    else {
        res.sendStatus(403);
    }
};
exports.verifyWebhook = verifyWebhook;
const receiveMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const entry = (_f = (_e = (_d = (_c = (_b = (_a = req.body.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.changes) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.messages) === null || _f === void 0 ? void 0 : _f[0];
    if (entry) {
        yield (0, whatsapp_service_1.handleIncomingMessage)(entry);
    }
    res.sendStatus(200);
});
exports.receiveMessage = receiveMessage;
const sendWhatsAppMessage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { to, message } = req.body;
        if (!to || !message)
            return res.status(400).json({ error: "Missing fields" });
        yield (0, whatsapp_service_1.sendMessage)(to, message);
        res.status(200).json({ message: "Message sent successfully" });
    }
    catch (error) {
        console.error("❌ Error sending message:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.sendWhatsAppMessage = sendWhatsAppMessage;
const getMessages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const messages = yield whatsappMessage_model_1.default.find();
        res.json(messages);
    }
    catch (error) {
        console.error("❌ Error fetching messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.getMessages = getMessages;
const getMessagesByPhoneNumber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { phoneNumber } = req.params;
    try {
        const messages = yield whatsappMessage_model_1.default.find({ from: phoneNumber });
        res.json(messages);
    }
    catch (error) {
        console.error("❌ Error fetching messages:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.getMessagesByPhoneNumber = getMessagesByPhoneNumber;
