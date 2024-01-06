## Users Table

Таблица всех пользователей

| Column    | Type         | Constraints              |
|-----------|--------------|--------------------------|
| id        | INTEGER      | PRIMARY KEY, AUTOINCREMENT |
| birthday  | DATE         | NOT NULL                 |
| nickname  | VARCHAR(32)  | UNIQUE, NOT NULL          |

## Chats Table

Таблица всех чатов

| Column     | Type         | Constraints                   |
|------------|--------------|-------------------------------|
| id         | INTEGER      | PRIMARY KEY                   |
| template   | TEXT         | DEFAULT 'С днем рождения {{nickname}}' |
| timeToSend | TEXT         | DEFAULT '12:00'              |

## UsersChats Table

m2m таблица для связи пользователей и чатов

| Column            | Type         | Constraints                        |
|-------------------|--------------|------------------------------------|
| userId            | INTEGER      |                                    |
| chatId            | INTEGER      |                                    |
| last_congratulation | DATE        | NULL                               |

- PRIMARY KEY (userId, chatId)
- FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
- FOREIGN KEY (chatId) REFERENCES Chats(id) ON DELETE CASCADE
