const operations = ["+", "-", "*", "/"];
const ratios = [40, 40, 10, 10];
const levelMilestoneNumbers = [[10, 10], [10, 100], [100, 100]];
let currentQuestionLevel = 1;
let operationPool = [];
export default async function() {
    let choosenOperation = chooseOperation();
    let choosenNumbers = findNumbers(currentQuestionLevel, choosenOperation);
    let isRightAnswer = Math.random() > 0.5;
    let result = isRightAnswer
        ? rightAnswer(choosenNumbers, choosenOperation)
        : createWrongAnswers(choosenNumbers, choosenOperation);

    return { choosenNumbers, choosenOperation, result, isRightAnswer };
}

function chooseOperation() {
    operations.forEach((operation, index) => {
        for (let x = 0; x < ratios[index]; x++) operationPool.push(operation);
    });

    return sample(operationPool);
}

function sample(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function findNumbers(level, operation) {
    let number1 = 3;
    let number2 = 2;
    switch (operation) {
        case "+":
            number1 = Math.round(Math.random() * levelMilestoneNumbers[level][0]);
            number2 = Math.round(Math.random() * levelMilestoneNumbers[level][1]);
            break;
        case "-":
            number1 = Math.max(10, Math.round(Math.random() * levelMilestoneNumbers[1][1]));
            number2 = Math.round(Math.random() * (number1 - 6));
            break;
        case "*":
            number1 = Math.round(Math.random() * levelMilestoneNumbers[level][0]);
            number2 = Math.round(Math.random() * 10);
            break;
        case "/":
            number1 = Math.round(Math.random() * 10);
            number2 = Math.round(Math.random() * levelMilestoneNumbers[level][1]);
            number1 = number1 * number2;
            break;
    }
    return [number1, number2];
}

function createWrongAnswers(choosenNumbers, choosenOperation) {
    let answer = rightAnswer(choosenNumbers, choosenOperation);
    let wrongAnswer = 0;
    switch (choosenOperation) {
        case "+":
        case "-":
        case "/":
            //Means +,- 5
            wrongAnswer = answer + Math.round(Math.random() * 10 - 5);
            break;
        case "*":
            // Means +,- 10 or 20
            wrongAnswer = answer + Math.round(Math.random() * 4 - 4) * 10;
            break;
    }
    return Math.abs(wrongAnswer);
}
function rightAnswer(choosenNumbers, choosenOperation) {
    let answer = 0;
    switch (choosenOperation) {
        case "+":
            answer = choosenNumbers[0] + choosenNumbers[1];
            break;
        case "-":
            answer = choosenNumbers[0] - choosenNumbers[1];
            break;
        case "*":
            answer = choosenNumbers[0] * choosenNumbers[1];
            break;
        case "/":
            answer = choosenNumbers[0] / choosenNumbers[1];
            break;
    }
    return answer;
}
