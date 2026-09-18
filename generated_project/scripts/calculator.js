document.addEventListener('DOMContentLoaded', () => {
    const display = document.getElementById('display');
    const buttons = document.getElementById('buttons');
    let currentInput = '';
    let operator = null;
    let firstOperand = null;

    buttons.addEventListener('click', (event) => {
        const target = event.target;

        if (target.classList.contains('number')) {
            handleNumber(target.textContent);
        } else if (target.classList.contains('operator')) {
            handleOperator(target.textContent);
        } else if (target.id === 'equals') {
            handleEquals();
        } else if (target.id === 'clear') {
            clearCalculator();
        }
    });

    function handleNumber(number) {
        currentInput += number;
        updateDisplay(currentInput);
    }

    function handleOperator(op) {
        if (currentInput === '' && firstOperand === null) return;

        if (firstOperand === null) {
            firstOperand = parseFloat(currentInput);
        } else if (operator) {
            firstOperand = calculate(firstOperand, parseFloat(currentInput), operator);
            updateDisplay(firstOperand);
        }

        operator = op;
        currentInput = '';
    }

    function handleEquals() {
        if (firstOperand !== null && operator && currentInput !== '') {
            const result = calculate(firstOperand, parseFloat(currentInput), operator);
            updateDisplay(result);
            firstOperand = result;
            currentInput = '';
            operator = null;
        }
    }

    function clearCalculator() {
        currentInput = '';
        operator = null;
        firstOperand = null;
        updateDisplay('');
    }

    function updateDisplay(value) {
        display.textContent = value;
    }

    function calculate(first, second, op) {
        switch (op) {
            case '+':
                return first + second;
            case '-':
                return first - second;
            case '*':
                return first * second;
            case '/':
                return second !== 0 ? first / second : 'Error';
            default:
                return second;
        }
    }
});
