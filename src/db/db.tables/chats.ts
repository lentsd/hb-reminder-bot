// lublu tebya cilno ochen);

import { Database } from "sqlite3";

export interface IChat{
    id: number;
    template: string;
    timeToSend: string;
}

/** Класс для работы с таблицей чатов */
export class ChatsTable{
    database: Database;

    constructor(database: Database){
        if (!database) {
            throw new Error('Can\'t initialize a table without database instance');
        }

        this.database = database;

        const sql = `
        CREATE TABLE IF NOT EXISTS Chats (
            id INTEGER PRIMARY KEY,
            template TEXT DEFAULT 'С днем рождения {{nickname}}',
            timeToSend TEXT DEFAULT '12:00'
        );`;
    
        database.run(sql, (err) => {
            if(err) {
                throw new Error(err.message);
            }
        });
    }

    /** Добавление нового чата */
    addChat = (chatId: number, cb?: (err: Error | null) => void) => {
        const sql = 'INSERT INTO Chats (id) VALUES (?);';
    
        this.database.run(sql, [chatId], cb);
    }

    /** Возращает конфиг чата */
    getChatConfig = (chatId: number, cb?: (err: Error | null, row: Pick<IChat, 'template' | 'timeToSend'>) => void) => {
        const sql = 'SELECT template, timeToSend FROM Chats where id = ?;';
    
        this.database.get<Pick<IChat, 'template' | 'timeToSend'>>(sql, [chatId], cb)
    }

    /** Устанавливает время отправки поздравления в чате. */
    setChatTimeToSend = (chatId: number, timeToSend: string, cb?: (err: Error | null) => void) => {
        const sql = `
        UPDATE Chats
        SET timeToSend = ?
        WHERE id = ?;`;
        
        this.database.run(sql, [timeToSend, chatId], cb);
    }

    /** Устанавливает шаблон поздравления в чате. */
    setChatTemplate = (chatId: number, template: string, cb?: (err: Error | null) => void) => {
        const sql = `
        UPDATE Chats
        SET template = ?
        WHERE id = ?;`;
        
        this.database.run(sql, [template, chatId], cb);
    }

    /** Возвращает все чаты у которых время оправки сообщения меньше переданного. */
    selectChatsWithPassedTime = (time: string) => {
        const sql = `
        SELECT *
        FROM Chats
        WHERE timeToSend <= strftime('%H:%M', ?);`;
    
        this.database.all(sql, [time], (err, data) => {
            console.log(data);
        })
    };
}