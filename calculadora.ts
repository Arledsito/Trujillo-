export {};

type Operacion = 'sumar' | 'restar' | 'multiplicar' | 'dividir';

const primerNumeroInput = document.getElementById('primerNumero') as HTMLInputElement;
const segundoNumeroInput = document.getElementById('segundoNumero') as HTMLInputElement;
const operacionSelect = document.getElementById('operacion') as HTMLSelectElement;
const btnCalcular = document.getElementById('btnCalcular') as HTMLButtonElement;
const valorResultado = document.getElementById('valorResultado') as HTMLSpanElement;
const listaOperaciones = document.getElementById('listaOperaciones') as HTMLUListElement;

const historial: string[] = [];

function calcular(): void {
    const primerNumero = Number.parseFloat(primerNumeroInput.value);
    const segundoNumero = Number.parseFloat(segundoNumeroInput.value);
    const operacion = operacionSelect.value as Operacion;

    if (Number.isNaN(primerNumero) || Number.isNaN(segundoNumero)) {
        window.alert('Por favor, ingresa los dos números.');
        return;
    }

    let resultado: number;
    let simbolo: string;

    switch (operacion) {
        case 'sumar':
            resultado = primerNumero + segundoNumero;
            simbolo = '+';
            break;
        case 'restar':
            resultado = primerNumero - segundoNumero;
            simbolo = '-';
            break;
        case 'multiplicar':
            resultado = primerNumero * segundoNumero;
            simbolo = 'x';
            break;
        case 'dividir':
            if (segundoNumero === 0) {
                window.alert('No se puede dividir entre cero.');
                return;
            }
            resultado = primerNumero / segundoNumero;
            simbolo = '/';
            break;
        default:
            return;
    }

    valorResultado.textContent = String(resultado);

    const registro = `${primerNumero} ${simbolo} ${segundoNumero} = ${resultado}`;
    historial.unshift(registro);
    actualizarHistorial();
}

function actualizarHistorial(): void {
    listaOperaciones.replaceChildren();

    historial.forEach((operacion) => {
        const elemento = document.createElement('li');
        elemento.textContent = operacion;
        listaOperaciones.appendChild(elemento);
    });
}

btnCalcular.addEventListener('click', calcular);
