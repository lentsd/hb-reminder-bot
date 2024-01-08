import TelegramBot from "node-telegram-bot-api";
import { BotMessages } from "./bot.const";
import { ChatsTable } from "../db/db.tables/chats";
import { UsersTable } from "../db/db.tables/users";
import { ChatsUsersTable } from "../db/db.tables/chatsUsers";
import { DbErrorChecker } from '../db/db.utils/dbErrorChecker';
import { convertDate } from "../db/db.utils/convertDate";

const dbErrorChecker = new DbErrorChecker();

/** Расширенный класс телеграм бота */
class TelegramBotExtended extends TelegramBot {
    override onText(regexp: RegExp, callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void): void {
        super.onText(regexp, (msg, match) => {
            if (msg.chat.type === 'private') {
                this.sendMessage(msg.chat.id, BotMessages.ONLY_GROUP_CHATS);
                return true;
            }

            callback(msg, match);
        })
    }
}

interface ITables {
    /** Таблица чатов */
    chatsTable: ChatsTable;
    /** Таблица юзеров */
    usersTable: UsersTable;
    /** Таблица m2m юзеры <-> чаты */
    chatsUsersTable: ChatsUsersTable;
}

/** Класс определяющий команды бота */
export class Bot {
    telegramBot: TelegramBot;
    tables: ITables

    constructor(tables: ITables) {
        this.telegramBot = new TelegramBotExtended(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.tables = tables;
    }

    /** Включение всех команд бота */
    init() {
        this.onStart();
        this.onGetChatConfig();
        this.onPing();
        this.onGetBirthdays();
        this.onSetBirthday();
        this.onSetTemplate();
        this.onSetTime();
    }

    /** Регистрация чата в БД */
    private onStart() {
        this.telegramBot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            
            this.tables.chatsTable.addChat(chatId, (err) => {
                if (err && dbErrorChecker.isAlreadyExist(err.message)) {
                    this.telegramBot.sendMessage(chatId, BotMessages.ALREADY_REGISTERED_CHAT);
                } else {
                    this.telegramBot.sendMessage(chatId, BotMessages.SUCCESS_REGISTRATION);
                }
            });
        });
    }

    /** Получение конфига чата: шаблон и время отправки */
    private onGetChatConfig() {
        this.telegramBot.onText(/\/get_chat_config/, (msg) => {
            const chatId = msg.chat.id;
        
            this.tables.chatsTable.getChatConfig(chatId, (err, row) => {
                if (err) {
                    return console.log('Error while getting chat config' + err);
                }
        
                this.telegramBot.sendMessage(
                    chatId, 
                    `*📝 Ваш шаблон:*\n\n${row.template}\n\n*⏱️ Время отправки:*\n\n${row.timeToSend}`,
                    { parse_mode: 'Markdown' }
                )
            });
        });
    }

    /** Получить все др в чате */
    private onGetBirthdays() {
        this.telegramBot.onText(/\/get_birthdays/, (msg) => {
            const chatId = msg.chat.id;
        
            this.tables.chatsUsersTable.getUsersInChat(chatId, (error, rows) => {
                const users = rows.reduce((acc, cur) => {
                    acc += `${cur.nickname} - ${cur.birthday}\n`;
            
                    return acc;
                }, '')
            
                this.telegramBot.sendMessage(chatId, users);
            });
        })
    }

    /** Установить / изменить день рождение пользователя */
    private onSetBirthday() {
        this.telegramBot.onText(/\/set_birthday/, async (msg) => {
            const chatId = msg.chat.id;
            const message = await this.telegramBot.sendMessage(
                chatId,
                `В ответ на это сообщение отправьте текст такого формата:\n\n*username - DD.MM.YYYY*\n\nНапример 👇🏼\n\n*ivan_petrov - 02.12.1998*`, 
                { parse_mode: 'Markdown' }
            );
          
            const { message_id } = message;
          
            const replyListenerId = this.telegramBot.onReplyToMessage(chatId, message_id, (msg) => {
              if(!msg.text) {
                return;
              }
          
              // Разбивка строки "nickname – birthday"
              const [nickname, birthday] = msg.text.split('-');
          
              this.tables.usersTable.addUser(nickname.trim(), convertDate(birthday.trim()), (insertedId) => {
                this.tables.chatsUsersTable.addUserChatRelation(insertedId, chatId);
              });
          
              this.telegramBot.sendMessage(chatId, 'Пользователь добавлен / обновлен 🫡');
              this.telegramBot.removeReplyListener(replyListenerId);
            })
        });
    }

    /** Устанавливает шаблон поздравления */
    private onSetTemplate() {
        this.telegramBot.onText(/\/set_template/, async (msg) => {
            const chatId = msg.chat.id;
        
            const { message_id } = await this.telegramBot.sendMessage(
                chatId,
                `В ответ на это сообщение отправьте шаблон такого формата:\n\n*Текст вашего поздравления и {{nickname}}*`, 
                { parse_mode: 'Markdown' }
            );
        
            const replyListenerId = this.telegramBot.onReplyToMessage(chatId, message_id, (msg) => {
                if (!msg.text) {
                    return
                }
            
                this.tables.chatsTable.setChatTemplate(chatId, msg.text, (err) => {
                    if (err) {
                        return console.log('Error while setting template' + err)
                    }
            
                    this.telegramBot.sendMessage(chatId, BotMessages.SUCCESS_TEMPLATE_SET);
                    this.telegramBot.removeReplyListener(replyListenerId);
                })
            })
        });
    }

    /** Устанавливает время поздравления в чате */
    private onSetTime() {
        this.telegramBot.onText(/\/set_time/, async (msg) => {
            const chatId = msg.chat.id;
            
            const { message_id } = await this.telegramBot.sendMessage(
                chatId,
                `В ответ на это сообщение отправьте время для поздравления такого формата:\n\n*HH:MM*\n\n*Например:*\n\n12:00`, 
                { parse_mode: 'Markdown' }
            );
            
            const replyListenerId = this.telegramBot.onReplyToMessage(chatId, message_id, (msg) => {
                if (!msg.text) {
                    return
                }
            
                this.tables.chatsTable.setChatTimeToSend(chatId, msg.text, (err) => {
                    if (err) {
                    return console.log('Error while setting time' + err)
                    }
            
                    this.telegramBot.sendMessage(chatId, BotMessages.SUCCESS_TIME_SET);
                    this.telegramBot.removeReplyListener(replyListenerId);
                })
            })
        });
    }

    /** Проверка, что бот живой и отвечает. Ифачок для особых юзеров :) */
    private onPing() {
        this.telegramBot.onText(/\/ping/, (msg) => {
            const chatId = msg.chat.id;
          
            if (msg.from?.username === 'kuratov_v') {
                this.telegramBot.sendPhoto(chatId, 'https://i.ytimg.com/vi/mL6gk8pzKjs/maxresdefault.jpg');
            } else {
                this.telegramBot.sendMessage(chatId, 'pong');
            }
        });
    }
}