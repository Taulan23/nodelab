const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Создаем папки если они не существуют
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');

[uploadsDir, downloadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Создана папка: ${dir}`);
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const fileFilter = (req, file, cb) => {
    if (file.originalname.endsWith('.7z')) {
        cb(null, true);
    } else {
        cb(new Error('Только .7z файлы разрешен'));
    }
};

const minSize = 5 * 1024 * 1024; // 5 МБ
const maxSize = 10 * 1024 * 1024; // 10 МБ

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: maxSize }
}).single('file');

// Обработка GET-запроса к корню сайта
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка POST-запроса от формы бронирования
app.post('/submit', (req, res) => {
    // Просто отправляем успешный ответ, без сохранения файла
    res.status(200).json({ 
        message: 'Данные успешно отправлены. Теперь вы можете скачать файл'
    });
});

// Обработка загрузки файла
app.post('/upload', (req, res) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер 10 МБ' });
            }
            return res.status(400).json({ error: err.message });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Файл не был загружен' });
        }

        if (req.file.size < minSize) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ error: 'Размер файла должен быть не менее 5 МБ' });
        }

        fs.chmod(req.file.path, 0o444, (err) => {
            if (err) {
                console.error('Ошибка при установке прав доступа:', err);
                return res.status(500).json({ error: 'Ошибка при установке прав доступа' });
            }
            res.json({
                message: 'Данные успешно отправлены. Вы может скачать файл.',
                filename: req.file.filename
            });
        });
    });
});

// Обработка скачивания файла
app.get('/download', (req, res) => {
    const {
        userName,
        pass,
        email,
        people,
        room,
        services,
        meal,
        calendar,
        city,
        abstracts,
        mailing
    } = req.query; // Получаем данные из запроса

    // Создаем имя файла с текущей датой
    const fileName = `booking_${Date.now()}.txt`;
    const filePath = path.join(downloadsDir, fileName);

    // Формируем строку для записи в файл
    const dataToWrite = `
=== Бронирование от ${new Date().toLocaleString()} ===
Имя: ${userName || 'Не указано'}
Email: ${email || 'Не указано'}
Количество человек: ${people || 'Не указано'}
Тип номера: ${room || 'Не указано'}
Услуги в номер: ${Array.isArray(services) ? services.join(', ') : services || 'Не выбраны'}
Питание: ${Array.isArray(meal) ? meal.join(', ') : meal || 'Не выбрано'}
Дата заселения: ${calendar || 'Не указана'}
Город заселения: ${city || 'Не указан'}
Дополнительные пожелания: ${abstracts || 'Нет'}
Подписка на рассылку: ${mailing || 'Не указано'}
=====================================\n`;

    // Записываем данные в файл и отправляем его
    fs.writeFile(filePath, dataToWrite, err => {
        if (err) {
            console.error('Ошибка при записи данных:', err);
            return res.status(500).json({ error: 'Ошибка при сохранении данных' });
        }
        
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Ошибка при скачивании:', err);
                return res.status(500).json({ error: 'Ошибка при скачивании файла' });
            }
        });
    });
});

// Оработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Что-то пошло не так!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});