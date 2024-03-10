const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");
// const fileUpload = require("express-fileupload");

const express = require("express");
const app = express();
const PORT = 80;

app.use(cors());
// app.use(fileUpload({}));

const storage = multer.diskStorage({
  destination: "uploads/", // папка, де будуть зберігатися файли
  filename: (req, file, cb) => {
    const filename = `${uuidv4()}_${file.originalname}`;
    cb(null, filename);
  },
});
const upload = multer({ storage });

// const filePath = "./10m.txt";
const highWaterMark = 65536; // Встановлюємо значення highWaterMark

const startTime = new Date(); // Фіксуємо початок обробки файлу

// Функція для зчитування та обробки чисел з файлу за допомогою стріму
async function processNumbersFromFileStream(filePath) {
  return new Promise((resolve, reject) => {
    let count = 0;
    let sum = 0;
    let buffer = ""; // буфер для зберігання неповного рядка з попереднього чанку
    let numbers = [];
    let maxSequenceGrowth = [];
    let currentSequenceGrowth = [];
    let maxSequenceDecrease = [];
    let currentSequenceDecrease = [];

    const readStream = fs.createReadStream(filePath, {
      encoding: "utf8",
      highWaterMark,
    });

    readStream.on("data", function (chunk) {
      chunk = buffer + chunk; // додаємо неповний рядок з попереднього чанку
      const lines = chunk.split("\n"); // розділяємо чанк на рядки
      const linesWithoutBuffer = lines.slice(0, lines.length - 1);
      buffer = lines[lines.length - 1]; // зберігаємо останній неповний рядок для обробки наступного чанку

      // Зростання
      for (let i = 0; i < linesWithoutBuffer.length; i++) {
        const element = +linesWithoutBuffer[i];

        if (!currentSequenceGrowth.length) {
          currentSequenceGrowth.push(element);
          continue;
        }

        if (currentSequenceGrowth[currentSequenceGrowth.length - 1] < element) {
          currentSequenceGrowth.push(element);
        }

        if (
          currentSequenceGrowth[currentSequenceGrowth.length - 1] >
          linesWithoutBuffer[i]
        ) {
          if (maxSequenceGrowth.length < currentSequenceGrowth.length) {
            maxSequenceGrowth.splice(
              0,
              maxSequenceGrowth.length,
              ...currentSequenceGrowth
            );
          }
          currentSequenceGrowth.splice(
            0,
            currentSequenceGrowth.length,
            element
          );
        }
      }

      // Спадання
      for (let i = 0; i < linesWithoutBuffer.length; i++) {
        const element = +linesWithoutBuffer[i];

        if (!currentSequenceDecrease.length) {
          currentSequenceDecrease.push(element);
          continue;
        }

        if (
          currentSequenceDecrease[currentSequenceDecrease.length - 1] > element
        ) {
          currentSequenceDecrease.push(element);
        }

        if (
          currentSequenceDecrease[currentSequenceDecrease.length - 1] <
          linesWithoutBuffer[i]
        ) {
          if (maxSequenceDecrease.length < currentSequenceDecrease.length) {
            maxSequenceDecrease.splice(
              0,
              maxSequenceDecrease.length,
              ...currentSequenceDecrease
            );
          }
          currentSequenceDecrease.splice(
            0,
            currentSequenceDecrease.length,
            element
          );
        }
      }

      // Перевірка на кількість елементів
      count += linesWithoutBuffer.length;
      sum += findChunkSum(linesWithoutBuffer);

      numbers.push(...linesWithoutBuffer);

      if (chunk.length < highWaterMark) {
        if (buffer && buffer.trim() !== "") {
          const lastNumber = parseFloat(buffer);
          numbers.push(lastNumber);
          count++;

          sum += lastNumber;
        }
      }
    });

    readStream.on("end", function () {
      let sortedNumbers = [];
      let median;
      let min = Number.MAX_SAFE_INTEGER;
      let max = Number.MIN_SAFE_INTEGER;

      sortedNumbers = quickSort(numbers);

      max = sortedNumbers[sortedNumbers.length - 1];
      min = sortedNumbers[0];
      median = findMedian(sortedNumbers);

      const average = sum / count;

      const endTime = new Date(); // Фіксуємо кінець обробки файлу
      const processingTime = endTime - startTime; // Визначаємо час обробки

      resolve({
        min,
        max,
        median,
        average,
        count,
        processingTime,
        maxSequenceGrowth,
        maxSequenceDecrease,
      });
    });

    readStream.on("error", function (err) {
      reject(err);
    });
  });
}

function quickSort(array) {
  if (array.length <= 1) {
    return array;
  }

  let pivotIndex = Math.floor(array.length / 2);
  let pivot = +array[pivotIndex];
  let less = [];
  let greater = [];

  for (let i = 0; i < array.length; i++) {
    if (i === pivotIndex) continue;

    if (+array[i] < pivot) {
      less.push(+array[i]);
    } else {
      greater.push(+array[i]);
    }
  }

  return [...quickSort(less), pivot, ...quickSort(greater)];
}

function findMedian(sortedNumbers) {
  const midIndex = Math.floor(sortedNumbers.length / 2);
  return sortedNumbers.length % 2 === 0
    ? (sortedNumbers[midIndex - 1] + sortedNumbers[midIndex]) / 2
    : sortedNumbers[midIndex];
}

function findChunkSum(lines) {
  let sum = 0;

  for (const line of lines) {
    sum += +line;
  }

  return sum;
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // Отримати ім'я файлу та інші дані з req.file
    const { filename, path } = req.file;
    console.log(filename);
    const filePath = `./uploads/${filename}`;

    // Обробка файлу (замість console.log розмістіть вашу логіку)
    const {
      min,
      max,
      median,
      average,
      processingTime,
      maxSequenceGrowth,
      maxSequenceDecrease,
    } = await processNumbersFromFileStream(filePath).then(
      ({
        min,
        max,
        median,
        average,
        processingTime,
        maxSequenceGrowth,
        maxSequenceDecrease,
      }) => {
        console.log("Мінімальне число:", min);
        console.log("Максимальне число:", max);
        console.log("Медіана", median);

        console.log("Середнє арифметичне:", average);

        console.log("Зростання", maxSequenceGrowth);
        console.log("Спадання", maxSequenceDecrease);

        console.log("Час обробки:", processingTime, "мс");

        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Помилка при видаленні файлу:", err);
          } else {
            console.log("Файл видалено успішно");
          }
        });

        return {
          min,
          max,
          median,
          average,
          processingTime,
          maxSequenceGrowth,
          maxSequenceDecrease,
        };
      }
    );

    console.log({
      min: min,
      max: max,
      median: median,
      average: average,
      processingTime: processingTime,
      maxSequenceGrowth: maxSequenceGrowth,
      maxSequenceDecrease: maxSequenceDecrease,
    });

    // Видалення файлу після обробки
    //  await fs.unlink(path);

    res.status(200).json({
      success: true,
      data: {
        min: min,
        max: max,
        median: median,
        average: average,
        processingTime: processingTime,
        maxSequenceGrowth: maxSequenceGrowth,
        maxSequenceDecrease: maxSequenceDecrease,
      },
      message: "File processed successfully",
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ success: false, message: "Error processing file" });
  }
});

app.listen(PORT, () => console.log("Server has been started on port: ", PORT));
