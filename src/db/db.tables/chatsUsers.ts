import { Database } from "sqlite3";
import type { IUser } from './users'
import { IChat } from "./chats";

export interface IChatsUsers{
    userId: number;
    chatId: number;
}

/** Класс для работы с таблицей чат <-> юзер */
export class ChatsUsersTable{
    database: Database;

    constructor(database: Database){
        if(!database) {
            throw new Error('Can\'t initialize a table without database instance');
        }

        this.database = database;

        const sql = `
        CREATE TABLE IF NOT EXISTS UsersChats (
            userId INTEGER,
            chatId INTEGER,
            last_congratulation DATE NULL,
            PRIMARY KEY (userId, chatId),
            FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE,
            FOREIGN KEY (chatId) REFERENCES Chats(chatId) ON DELETE CASCADE
        );`;
    
        database.run(sql, (err) => {
            if (err) {
                throw new Error(err.message);
            }
        });
    }

    addUserChatRelation = (userId: number, chatId: number) => {
        const sql = 'INSERT OR IGNORE INTO UsersChats (userId, chatId) VALUES (?, ?);';

        this.database.run(sql, [userId, chatId]);
    }

    /** Получение всех чатов пользователя где есть бот */
    getAllUserChats = (userId: number, cb: (error: Error | null, rows: Array<IChat>) => void) => {
        const sql = `
            SELECT Chats.*
            FROM UsersChats
            JOIN Chats ON Chats.id = UsersChats.chatId
            WHERE UsersChats.userId = ?;
        `;

        this.database.all(sql, [userId], cb);
    }

    /** Получение всех юзеров в чате по айди чата */
    getUsersInChat = (chatId: number, cb: (error: Error | null, rows: Array<IUser>) => void) => {
        const sql = `
            SELECT Users.*, strftime('%d.%m.%Y', Users.birthday) as birthday
            FROM Users
            INNER JOIN UsersChats ON Users.id = UsersChats.userId
            WHERE UsersChats.chatId = ?;
        `;

        this.database.all<IUser>(sql, [chatId], cb);
    }

    /** Получение всех юзеров у кого сегодня др */
    getUsersWithTodayBirthday(cb: (err: Error | null, rows: Array<IUser>) => void) {
        const sql = `
            SELECT * 
            FROM Users 
            INNER JOIN UsersChats ON Users.id = UsersChats.userId
            WHERE strftime('%d.%m', birthday) = strftime('%d.%m', 'now') 
            AND (last_congratulation != CURRENT_DATE OR last_congratulation IS NULL);
        `;

        this.database.all<IUser>(sql, cb);
    }

    /** Отмечает, когда последний раз был поздравлен человек в чате */
    setUserCongrats(userId: number, chatId: number) {
        const sql = `
            UPDATE UsersChats
            SET last_congratulation = CURRENT_DATE
            WHERE userId = ? and chatId = ?;
        `;

        this.database.run(sql, userId, chatId);
    }
}


