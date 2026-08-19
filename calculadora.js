const primerNumeroInput = document.getElementById('primerNumero');
const segundoNumeroInput = document.getElementById('segundoNumero');
const operacionSelect = document.getElementById('operacion');
const btnCalcular = document.getElementById('btnCalcular');
const valorResultado = document.getElementById('valorResultado');
const listaOperaciones = document.getElementById('listaOperaciones');

const historial = [];

function calcular() {
    const primerNumero = Number.parseFloat(primerNumeroInput.value);
    const segundoNumero = Number.parseFloat(segundoNumeroInput.value);
    const operacion = operacionSelect.value;

    if (Number.isNaN(primerNumero) || Number.isNaN(segundoNumero)) {
        window.alert('Por favor, ingresa los dos números.');
        return;
    }

    let resultado;
    let simbolo;

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

function actualizarHistorial() {
    listaOperaciones.replaceChildren();

    historial.forEach((operacion) => {
        const elemento = document.createElement('li');
        elemento.textContent = operacion;
        listaOperaciones.appendChild(elemento);
    });
}

btnCalcular.addEventListener('click', calcular);
