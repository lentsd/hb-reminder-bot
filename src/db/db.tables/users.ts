import { Database } from "sqlite3";

export interface IUser{
    id: number;
    birthday: string;
    nickname: string;
}

/** Класс для работы с таблицей юзеров */
export class UsersTable{
    database: Database;

    constructor(database: Database){
        if (!database) {
            throw new Error('Can\'t initialize a table without database instance');
        }

        this.database = database;

        const sql = `
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            birthday DATE NOT NULL,
            nickname VARCHAR(32) UNIQUE NOT NULL 
        );`;
    
        database.run(sql, (err) => {
            if(err) {
                throw new Error(err.message);
            }
        });
    }

    addUser = (nickname: string, birthday: string, cb?: (insertedId: number) => void) => {
        const sql = 'INSERT OR REPLACE INTO Users (nickname, birthday) VALUES (?, ?)';

        this.database.run(sql, [nickname, birthday], function(err) {
            if (err) {
                return console.log(err);
            }

            cb?.(this.lastID);
        });
    }
}