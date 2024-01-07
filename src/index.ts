import 'source-map-support/register'
import { verbose } from 'sqlite3';
import { config } from 'dotenv';
import { scheduleJob } from 'node-schedule';

import { ChatsTable, IChat } from './db/db.tables/chats';
import { IUser, UsersTable } from './db/db.tables/users';
import { ChatsUsersTable } from './db/db.tables/chatsUsers';
import { Bot } from './bot/bot';

// Инициализация работы .env
config();

const sqlite3 = verbose();

const db = new sqlite3.Database('src/db/db.sqlite', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        return console.error(err);
    }

    // Включает поддержку FK в бд
    db.run('PRAGMA foreign_keys=ON');
})

const chatsTable = new ChatsTable(db);
const usersTable = new UsersTable(db);
const chatsUsersTable = new ChatsUsersTable(db);

const bot = new Bot({ chatsTable, usersTable, chatsUsersTable });

bot.init();

function congratulateUsers() {
  chatsUsersTable.getUsersWithTodayBirthday((err, users) => {
    if (err) {
      return console.log('Error while congratulateUsers' + err);
    }

    users.forEach(user => {
      chatsUsersTable.getAllUserChats(user.id, (err, chats) => {
        chats.forEach((chat) => {
          congratulateUser(user, chat);
        })
      })
    })
  });
}

function congratulateUser(user: IUser, chat: IChat) {
  chatsUsersTable.setUserCongrats(user.id, chat.id);
  bot.telegramBot.sendMessage(chat.id, chat.template.replace('{{nickname}}', `@${user.nickname}`))
}

// Каждые 10 минут поздравляем юзеров
scheduleJob('*/10 * * * *', () => {
  congratulateUsers();
})