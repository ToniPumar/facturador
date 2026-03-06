import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Imports locales originales, los dejamos comentados por si quieres volver al modo solo-local.
// import datosClientes from "./datos/clientes.json";
// import datosArticulos from "./datos/articulos.json";

// Fallback local por si falla la carga desde GitHub RAW.
import datosClientesLocal from "./datos/clientes.json";
import datosArticulosLocal from "./datos/articulos.json";

type Cliente = {
  nombre: string;
  nif: string;
  direccion: string;
  poblacion: string;
  cp: string;
  telefono: string;
  iva?: number | string | null;
};

type RespuestaClientes = {
  clientes: Cliente[];
};

type Articulo = {
  codigo: string;
  descripcion: string;
  precio: number;
};

type RespuestaArticulos = {
  articulos: Articulo[];
};

const URL_CLIENTES_RAW =
  "https://raw.githubusercontent.com/ToniPumar/facturador/main/src/datos/clientes.json";

const URL_ARTICULOS_RAW =
  "https://raw.githubusercontent.com/ToniPumar/facturador/main/src/datos/articulos.json";

const MINIMO_CARACTERES_BUSQUEDA = 4;

let clientesCargados: Cliente[] = [];
let articulosCargados: Articulo[] = [];

// =====================================
// PDF
// =====================================

function obtenerNombreArchivo(): string {
  const numeroFactura = (document.getElementById("numeroFactura") as HTMLInputElement | null)?.value?.trim();
  const fechaFactura = (document.getElementById("fechaFactura") as HTMLInputElement | null)?.value?.trim();
  const nombreCliente = (document.getElementById("nombreCliente") as HTMLInputElement | null)?.value?.trim();

  const parteNumero = numeroFactura ? numeroFactura : "sin-numero";
  const parteFecha = fechaFactura ? fechaFactura : "sin-fecha";
  const nombre = nombreCliente ? nombreCliente : "sin-nombre";

  return `${nombre}-${parteNumero}-${parteFecha}.pdf`;
}

async function generarPdfFactura(): Promise<void> {
  const contenedorFactura = document.querySelector(".factura") as HTMLElement | null;
  if (!contenedorFactura) {
    alert("No se encontró el contenedor .factura");
    return;
  }

  const canvas = await html2canvas(contenedorFactura, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: document.documentElement.scrollWidth,
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");
  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();

  const imgProps = pdf.getImageProperties(imgData);
  const anchoImg = anchoPagina;
  const altoImg = (imgProps.height * anchoImg) / imgProps.width;

  if (altoImg <= altoPagina) {
    pdf.addImage(imgData, "PNG", 0, 0, anchoImg, altoImg);
    pdf.save(obtenerNombreArchivo());
    return;
  }

  let altoRestante = altoImg;
  let posicionY = 0;

  pdf.addImage(imgData, "PNG", 0, posicionY, anchoImg, altoImg);
  altoRestante -= altoPagina;

  while (altoRestante > 0) {
    pdf.addPage();
    posicionY = -(altoImg - altoRestante);
    pdf.addImage(imgData, "PNG", 0, posicionY, anchoImg, altoImg);
    altoRestante -= altoPagina;
  }

  pdf.save(obtenerNombreArchivo());
}

// =====================================
// UTILIDADES GENERALES
// =====================================

function ponerFechaHoyPorDefecto(): void {
  const campoFecha = document.getElementById("fechaFactura") as HTMLInputElement | null;
  if (!campoFecha) return;

  if (!campoFecha.value) {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, "0");
    const dd = String(hoy.getDate()).padStart(2, "0");
    campoFecha.value = `${yyyy}-${mm}-${dd}`;
  }
}

function actualizarVisibilidadCuenta(): void {
  const selectorFormaPago = document.getElementById("formaPago") as HTMLSelectElement | null;
  const bloqueCuenta = document.getElementById("bloqueCuenta") as HTMLDivElement | null;

  if (!selectorFormaPago || !bloqueCuenta) return;

  const esTransferencia = selectorFormaPago.value === "transferencia";
  bloqueCuenta.style.display = esTransferencia ? "block" : "none";
}

function convertirANumero(valor: string): number {
  const numero = parseFloat(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function formatearEuros(cantidad: number): string {
  return `${cantidad.toFixed(2)} €`;
}

function normalizarTexto(texto: string): string {
  return texto.trim().toLowerCase();
}

// =====================================
// CÁLCULOS FACTURA
// =====================================

function calcularTotalesLineas(): void {
  const filas = document.querySelectorAll("#cuerpoArticulos tr");

  filas.forEach((fila) => {
    const campoPrecio = fila.querySelector(".precioArticulo") as HTMLInputElement | null;
    const campoUnidades = fila.querySelector(".unidadesArticulo") as HTMLInputElement | null;
    const celdaTotal = fila.querySelector(".totalLinea") as HTMLTableCellElement | null;

    if (!campoPrecio || !campoUnidades || !celdaTotal) return;

    const precio = convertirANumero(campoPrecio.value);
    const unidades = convertirANumero(campoUnidades.value);
    const totalLinea = precio * unidades;

    celdaTotal.textContent = totalLinea > 0 ? formatearEuros(totalLinea) : "";
  });
}

function calcularBaseImponible(): number {
  const filas = document.querySelectorAll("#cuerpoArticulos tr");
  let baseImponible = 0;

  filas.forEach((fila) => {
    const campoPrecio = fila.querySelector(".precioArticulo") as HTMLInputElement | null;
    const campoUnidades = fila.querySelector(".unidadesArticulo") as HTMLInputElement | null;

    if (!campoPrecio || !campoUnidades) return;

    const precio = convertirANumero(campoPrecio.value);
    const unidades = convertirANumero(campoUnidades.value);

    baseImponible += precio * unidades;
  });

  const elementoBaseImponible = document.getElementById("totalNeto");
  if (elementoBaseImponible) {
    elementoBaseImponible.textContent = formatearEuros(baseImponible);
  }

  return baseImponible;
}

function calcularIva(baseImponible: number): number {
  const campoPorcentajeIva = document.getElementById("porcentajeIva") as HTMLInputElement | null;
  const elementoIva = document.getElementById("totalIva");

  if (!campoPorcentajeIva) return 0;

  const porcentajeIva = convertirANumero(campoPorcentajeIva.value);
  const importeIva = baseImponible * (porcentajeIva / 100);

  if (elementoIva) {
    elementoIva.textContent = formatearEuros(importeIva);
  }

  return importeIva;
}

function calcularTotalFactura(baseImponible: number, importeIva: number): number {
  const totalFactura = baseImponible + importeIva;
  const elementoTotalFactura = document.getElementById("totalFactura");

  if (elementoTotalFactura) {
    elementoTotalFactura.textContent = formatearEuros(totalFactura);
  }

  return totalFactura;
}

function recalcularFactura(): void {
  calcularTotalesLineas();
  const baseImponible = calcularBaseImponible();
  const importeIva = calcularIva(baseImponible);
  calcularTotalFactura(baseImponible, importeIva);
}

// =====================================
// CLIENTES JSON + AUTOCOMPLETE
// =====================================

async function cargarClientes(): Promise<void> {
  try {
    const respuesta = await fetch(URL_CLIENTES_RAW, {
      cache: "no-store",
    });

    if (!respuesta.ok) {
      throw new Error(`Error cargando clientes RAW: ${respuesta.status}`);
    }

    const datos = (await respuesta.json()) as RespuestaClientes;
    clientesCargados = Array.isArray(datos.clientes) ? datos.clientes : [];

    console.log("Clientes cargados desde RAW:", clientesCargados);
  } catch (error) {
    console.warn("Falló la carga de clientes desde RAW, uso el JSON local:", error);

    try {
      const datosLocales = datosClientesLocal as RespuestaClientes;
      clientesCargados = Array.isArray(datosLocales.clientes) ? datosLocales.clientes : [];
      console.log("Clientes cargados desde JSON local:", clientesCargados);
    } catch (errorLocal) {
      console.error("No se pudieron cargar los clientes ni en RAW ni en local:", errorLocal);
      clientesCargados = [];
    }
  }
}

function obtenerContenedorResultadosClientes(): HTMLDivElement | null {
  return document.getElementById("resultadosClientes") as HTMLDivElement | null;
}

function limpiarResultadosClientes(): void {
  const contenedor = obtenerContenedorResultadosClientes();
  if (!contenedor) return;

  contenedor.innerHTML = "";
  contenedor.classList.remove("visible");
}

function obtenerTextoIva(iva: Cliente["iva"]): string {
  if (iva === null || iva === undefined || iva === "") {
    return "IVA por defecto";
  }

  return `IVA ${iva}%`;
}

function buscarClientesPorTexto(texto: string): Cliente[] {
  const textoNormalizado = normalizarTexto(texto);

  if (textoNormalizado.length < MINIMO_CARACTERES_BUSQUEDA) {
    return [];
  }

  return clientesCargados.filter((cliente) =>
    normalizarTexto(cliente.nombre).includes(textoNormalizado)
  );
}

function rellenarDatosCliente(cliente: Cliente): void {
  const campoNombre = document.getElementById("nombreCliente") as HTMLInputElement | null;
  const campoNif = document.getElementById("dniCliente") as HTMLInputElement | null;
  const campoDireccion = document.getElementById("direccionCliente") as HTMLInputElement | null;
  const campoPoblacion = document.getElementById("poblacionCliente") as HTMLInputElement | null;
  const campoCp = document.getElementById("cpCliente") as HTMLInputElement | null;
  const campoTelefono = document.getElementById("telefonoCliente") as HTMLInputElement | null;
  const campoIva = document.getElementById("porcentajeIva") as HTMLInputElement | null;

  if (campoNombre) campoNombre.value = cliente.nombre ?? "";
  if (campoNif) campoNif.value = cliente.nif ?? "";
  if (campoDireccion) campoDireccion.value = cliente.direccion ?? "";
  if (campoPoblacion) campoPoblacion.value = cliente.poblacion ?? "";
  if (campoCp) campoCp.value = cliente.cp ?? "";
  if (campoTelefono) campoTelefono.value = cliente.telefono ?? "";

  if (
    campoIva &&
    cliente.iva !== null &&
    cliente.iva !== undefined &&
    cliente.iva !== ""
  ) {
    campoIva.value = String(cliente.iva);
  }

  limpiarResultadosClientes();
  recalcularFactura();
}

function mostrarResultadosClientes(clientes: Cliente[]): void {
  const contenedor = obtenerContenedorResultadosClientes();
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (clientes.length === 0) {
    contenedor.classList.remove("visible");
    return;
  }

  clientes.forEach((cliente) => {
    const opcion = document.createElement("div");
    opcion.className = "resultadoCliente";

    opcion.innerHTML = `
      <div class="resultadoClienteNombre">${cliente.nombre}</div>
      <div class="resultadoClienteIva">${obtenerTextoIva(cliente.iva)}</div>
    `;

    opcion.addEventListener("click", () => {
      rellenarDatosCliente(cliente);
    });

    contenedor.appendChild(opcion);
  });

  contenedor.classList.add("visible");
}

function iniciarAutocompleteClientes(): void {
  const campoNombre = document.getElementById("nombreCliente") as HTMLInputElement | null;
  const contenedor = obtenerContenedorResultadosClientes();

  if (!campoNombre || !contenedor) return;

  campoNombre.addEventListener("input", () => {
    const resultados = buscarClientesPorTexto(campoNombre.value);
    mostrarResultadosClientes(resultados);
  });

  campoNombre.addEventListener("focus", () => {
    const resultados = buscarClientesPorTexto(campoNombre.value);
    mostrarResultadosClientes(resultados);
  });

  document.addEventListener("click", (evento) => {
    const objetivo = evento.target as Node;
    const bloqueAutocomplete = campoNombre.closest(".campoAutocomplete");

    if (!bloqueAutocomplete) return;

    if (!bloqueAutocomplete.contains(objetivo)) {
      limpiarResultadosClientes();
    }
  });
}

// =====================================
// ARTÍCULOS JSON + DATALIST
// =====================================

async function cargarArticulos(): Promise<void> {
  try {
    const respuesta = await fetch(URL_ARTICULOS_RAW, {
      cache: "no-store",
    });

    if (!respuesta.ok) {
      throw new Error(`Error cargando artículos RAW: ${respuesta.status}`);
    }

    const datos = (await respuesta.json()) as RespuestaArticulos;
    articulosCargados = Array.isArray(datos.articulos) ? datos.articulos : [];

    console.log("Artículos cargados desde RAW:", articulosCargados);
  } catch (error) {
    console.warn("Falló la carga de artículos desde RAW, uso el JSON local:", error);

    try {
      const datosLocales = datosArticulosLocal as RespuestaArticulos;
      articulosCargados = Array.isArray(datosLocales.articulos) ? datosLocales.articulos : [];
      console.log("Artículos cargados desde JSON local:", articulosCargados);
    } catch (errorLocal) {
      console.error("No se pudieron cargar los artículos ni en RAW ni en local:", errorLocal);
      articulosCargados = [];
    }
  }
}

function obtenerCodigosUnicos(): string[] {
  return [...new Set(
    articulosCargados
      .map((articulo) => articulo.codigo)
      .filter((codigo) => codigo && codigo.trim() !== "")
  )].sort((a, b) => a.localeCompare(b, "es"));
}

function obtenerArticulosPorCodigo(codigo: string): Articulo[] {
  const codigoNormalizado = normalizarTexto(codigo);

  if (!codigoNormalizado) {
    return [];
  }

  return articulosCargados.filter(
    (articulo) => normalizarTexto(articulo.codigo) === codigoNormalizado
  );
}

function buscarArticuloExacto(codigo: string, descripcion: string): Articulo | undefined {
  const codigoNormalizado = normalizarTexto(codigo);
  const descripcionNormalizada = normalizarTexto(descripcion);

  return articulosCargados.find(
    (articulo) =>
      normalizarTexto(articulo.codigo) === codigoNormalizado &&
      normalizarTexto(articulo.descripcion) === descripcionNormalizada
  );
}

function crearDatalistSiNoExiste(id: string, contenedor: HTMLElement): HTMLDataListElement {
  let datalist = document.getElementById(id) as HTMLDataListElement | null;

  if (!datalist) {
    datalist = document.createElement("datalist");
    datalist.id = id;
    contenedor.appendChild(datalist);
  }

  return datalist;
}

function rellenarDatalistCodigos(datalist: HTMLDataListElement): void {
  const codigos = obtenerCodigosUnicos();
  datalist.innerHTML = "";

  codigos.forEach((codigo) => {
    const option = document.createElement("option");
    option.value = codigo;
    datalist.appendChild(option);
  });
}

function actualizarDatalistDescripcionesFila(fila: HTMLTableRowElement, indice: number): void {
  const campoCodigo = fila.querySelector(".codigoArticulo") as HTMLInputElement | null;
  const celdaDescripcion = fila.children[1] as HTMLElement | undefined;

  if (!campoCodigo || !celdaDescripcion) return;

  const idDatalistDescripcion = `listaDescripcionesArticulo-${indice}`;
  const datalistDescripcion = crearDatalistSiNoExiste(idDatalistDescripcion, celdaDescripcion);

  datalistDescripcion.innerHTML = "";

  const articulosDelCodigo = obtenerArticulosPorCodigo(campoCodigo.value);

  articulosDelCodigo.forEach((articulo) => {
    const option = document.createElement("option");
    option.value = articulo.descripcion;
    datalistDescripcion.appendChild(option);
  });
}

function aplicarPrecioSegunArticuloFila(fila: HTMLTableRowElement): void {
  const campoCodigo = fila.querySelector(".codigoArticulo") as HTMLInputElement | null;
  const campoDescripcion = fila.querySelector(".nombreArticulo") as HTMLInputElement | null;
  const campoPrecio = fila.querySelector(".precioArticulo") as HTMLInputElement | null;

  if (!campoCodigo || !campoDescripcion || !campoPrecio) return;

  const articuloEncontrado = buscarArticuloExacto(campoCodigo.value, campoDescripcion.value);

  if (!articuloEncontrado) return;

  campoPrecio.value = String(articuloEncontrado.precio);
  recalcularFactura();
}

function iniciarAutocompleteArticulos(): void {
  const filas = document.querySelectorAll("#cuerpoArticulos tr");

  filas.forEach((filaElemento, indice) => {
    const fila = filaElemento as HTMLTableRowElement;
    const campoCodigo = fila.querySelector(".codigoArticulo") as HTMLInputElement | null;
    const campoDescripcion = fila.querySelector(".nombreArticulo") as HTMLInputElement | null;
    const celdaCodigo = fila.children[0] as HTMLElement | undefined;

    if (!campoCodigo || !campoDescripcion || !celdaCodigo) return;

    const idDatalistCodigo = `listaCodigosArticulo-${indice}`;
    const datalistCodigo = crearDatalistSiNoExiste(idDatalistCodigo, celdaCodigo);

    rellenarDatalistCodigos(datalistCodigo);
    campoCodigo.setAttribute("list", idDatalistCodigo);

    const idDatalistDescripcion = `listaDescripcionesArticulo-${indice}`;
    campoDescripcion.setAttribute("list", idDatalistDescripcion);

    actualizarDatalistDescripcionesFila(fila, indice);

    campoCodigo.addEventListener("input", () => {
      actualizarDatalistDescripcionesFila(fila, indice);
    });

    campoCodigo.addEventListener("change", () => {
      actualizarDatalistDescripcionesFila(fila, indice);
      aplicarPrecioSegunArticuloFila(fila);
    });

    campoDescripcion.addEventListener("input", () => {
      aplicarPrecioSegunArticuloFila(fila);
    });

    campoDescripcion.addEventListener("change", () => {
      aplicarPrecioSegunArticuloFila(fila);
    });
  });
}

// =====================================
// EVENTOS
// =====================================

function iniciarEventos(): void {
  const selectorFormaPago = document.getElementById("formaPago") as HTMLSelectElement | null;
  const campoPorcentajeIva = document.getElementById("porcentajeIva") as HTMLInputElement | null;
  const botonPdf = document.getElementById("botonPdf") as HTMLButtonElement | null;

  const camposPrecio = document.querySelectorAll(".precioArticulo");
  const camposUnidades = document.querySelectorAll(".unidadesArticulo");

  if (selectorFormaPago) {
    selectorFormaPago.addEventListener("change", actualizarVisibilidadCuenta);
  }

  if (campoPorcentajeIva) {
    campoPorcentajeIva.addEventListener("input", recalcularFactura);
  }

  camposPrecio.forEach((campo) => {
    campo.addEventListener("input", recalcularFactura);
  });

  camposUnidades.forEach((campo) => {
    campo.addEventListener("input", recalcularFactura);
  });

  if (botonPdf) {
    botonPdf.addEventListener("click", async () => {
      botonPdf.disabled = true;
      botonPdf.textContent = "Generando PDF...";
      try {
        await generarPdfFactura();
      } finally {
        botonPdf.disabled = false;
        botonPdf.textContent = "📄 Descargar PDF";
      }
    });
  }
}

// =====================================
// MAIN
// =====================================

async function iniciar(): Promise<void> {
  ponerFechaHoyPorDefecto();
  await cargarClientes();
  await cargarArticulos();
  iniciarAutocompleteClientes();
  iniciarAutocompleteArticulos();
  actualizarVisibilidadCuenta();
  recalcularFactura();
  iniciarEventos();
}

document.addEventListener("DOMContentLoaded", () => {
  void iniciar();
});