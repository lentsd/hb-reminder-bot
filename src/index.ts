import 'source-map-support/register'
import { verbose } from 'sqlite3';
import TelegramBot from 'node-telegram-bot-api';
import { config } from 'dotenv';
import { scheduleJob } from 'node-schedule';

import { ChatsTable } from './db/db.tables/chats';
import { UsersTable } from './db/db.tables/users';
import { ChatsUsersTable } from './db/db.tables/chatsUsers';
import { DbErrorChecker } from './db/db.utils/dbErrorChecker';
import { convertDate } from './db/db.utils/convertDate';

// Инициализация работы .env
config();

const sqlite3 = verbose();
const dbErrorChecker = new DbErrorChecker();

const db = new sqlite3.Database(
    'src/db/db.sqlite',
    sqlite3.OPEN_READWRITE,
    (err) => {

    if (err) {
        return console.error(err);
    }

    // Включает поддержку FK в бд
    db.run('PRAGMA foreign_keys=ON');
})

const chatsTable = new ChatsTable(db);
const usersTable = new UsersTable(db);
const chatsUsersTable = new ChatsUsersTable(db);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Регистрация чата в БД
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  chatsTable.addChat(chatId, (err) => {
    if (err) {
      if (dbErrorChecker.isAlreadyExist(err.message)) {
        bot.sendMessage(chatId, 'Этот чат уже добавлен в систему! Для добавления пользователей используйте /set_birthday.');
      }
    } else {
      bot.sendMessage(chatId, 'Приятно познакомиться, чат! Для добавления пользователей используйте /set_birthday');
    }
  });
});

// Добавление дней рождений
bot.onText(/\/set_birthday/, async (msg) => {
  const chatId = msg.chat.id;
  const message = await bot.sendMessage(chatId, `В ответ на это сообщение отправьте текст такого формата:

*username - DD.MM.YYYY*

Например 👇🏼 

*ivan_petrov - 02.12.1998*`, 
{ parse_mode: 'Markdown' }
);

  const { message_id } = message;

  const replyListenerId = bot.onReplyToMessage(chatId, message_id, (msg) => {
    if (!msg.text) {
      return;
    }

    // Разбивка строки "nickname – birthday"
    const [nickname, birthday] = msg.text.split('-');

    usersTable.addUser(nickname.trim(), convertDate(birthday.trim()), (insertedId) => {
      chatsUsersTable.addUserChatRelation(insertedId, chatId);
    });

    bot.sendMessage(chatId, '🫡');
    bot.removeReplyListener(replyListenerId);
  })
});

// Получить все др в чате
bot.onText(/\/get_birthdays/, (msg) => {
  const chatId = msg.chat.id;

  chatsUsersTable.getUsersInChat(chatId, (error, rows) => {
    const users = rows.reduce((acc, cur) => {
      acc += `${cur.nickname} - ${cur.birthday}\n`;

      return acc;
    }, '')

    bot.sendMessage(chatId, users);
  });
})

// Проверка, что бот живой. Особый ифачок для Вовы.
bot.onText(/\/ping/, (msg) => {
  const chatId = msg.chat.id;

  if (msg.from?.username === 'kuratov_v') {
    bot.sendPhoto(chatId, 'https://i.ytimg.com/vi/mL6gk8pzKjs/maxresdefault.jpg');
  } else {
    bot.sendMessage(chatId, 'pong');
  }
});

// Отправляет конфиг чата
bot.onText(/\/get_chat_config/, (msg) => {
  const chatId = msg.chat.id;

  chatsTable.getChatConfig(chatId, (err, row) => {
    if (err) {
      return console.log('Error while getting chat config' + err);
    }

    bot.sendMessage(chatId, `
*📝 Ваш шаблон:*

${row.template}

*⏱️ Время отправки:*

${row.timeToSend}`,
{ parse_mode: 'Markdown' })
  });
});

// Устанавливет шаблон поздравления
bot.onText(/\/set_template/, async (msg) => {
  const chatId = msg.chat.id;

  const { message_id } = await bot.sendMessage(chatId, `В ответ на это сообщение отправьте шаблон такого формата:

*Текст вашего поздравления и {{nickname}}*`, 
  { parse_mode: 'Markdown' }
  );

  const replyListenerId = bot.onReplyToMessage(chatId, message_id, (msg) => {
    if (!msg.text) {
      return
    }

    chatsTable.setChatTemplate(chatId, msg.text, (err) => {
      if (err) {
        return console.log('Error while setting template' + err)
      }

      bot.sendMessage(chatId, '🫡');
      bot.removeReplyListener(replyListenerId);
    })
  })
});

// Устанавливет время поздравления
bot.onText(/\/set_time/, async (msg) => {
  const chatId = msg.chat.id;

  const { message_id } = await bot.sendMessage(chatId, `В ответ на это сообщение отправьте время для поздравления такого формата:

*HH:MM*

*Например:*

12:00`, 
  { parse_mode: 'Markdown' }
  );

  const replyListenerId = bot.onReplyToMessage(chatId, message_id, (msg) => {
    if (!msg.text) {
      return
    }

    chatsTable.setChatTimeToSend(chatId, msg.text, (err) => {
      if (err) {
        return console.log('Error while setting time' + err)
      }

      bot.sendMessage(chatId, '🫡');
      bot.removeReplyListener(replyListenerId);
    })
  })
});

function congratulateUsers() {
  chatsUsersTable.getUsersWithTodayBirthday((err, users) => {
    if (err) {
      return console.log('Error while congratulateUsers' + err);
    }

    users.forEach(user => {
      chatsUsersTable.getAllUserChats(user.id, (err, chats) => {
        chats.forEach((chat) => {
          chatsUsersTable.setUserCongrats(user.id, chat.id);
          bot.sendMessage(chat.id, chat.template.replace('{{nickname}}', `@${user.nickname}`))
        })
      })
    })
  });
}

// Каждые 10 минут проверяем есть ли у кого др и поздравляем
scheduleJob('*/10 * * * *', () => {
  congratulateUsers();
})