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
exports.sendMessage = exports.handleIncomingMessage = void 0;
const axios_1 = __importDefault(require("axios"));
const whatsappMessage_model_1 = __importDefault(require("../models/whatsappMessage.model"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const WHATSAPP_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
console.log('WhatsApp Token:', WHATSAPP_TOKEN);
console.log('WhatsApp Phone Number ID:', PHONE_NUMBER_ID);
const handleIncomingMessage = (message) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const from = message.from;
    const text = ((_a = message.text) === null || _a === void 0 ? void 0 : _a.body) || 'No message text';
    console.log(`📥 New message from ${from}: ${text}`);
    yield whatsappMessage_model_1.default.create({
        from,
        type: 'incoming',
        message: text,
    });
    // Echo back the message
    yield (0, exports.sendMessage)(from, `Received: ${text}`);
});
exports.handleIncomingMessage = handleIncomingMessage;
const sendMessage = (to, text) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    try {
        yield axios_1.default.post(url, {
            messaging_product: 'whatsapp',
            to,
            text: { body: text },
        }, {
            headers: {
                Authorization: `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });
        yield whatsappMessage_model_1.default.create({
            from: 'LeonHub',
            to,
            type: 'outgoing',
            message: text,
        });
        console.log(`📤 Sent message to ${to}`);
    }
    catch (error) {
        console.error('❌ Error sending WhatsApp message:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
    }
});
exports.sendMessage = sendMessage;
