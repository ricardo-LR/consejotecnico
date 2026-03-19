"""
populate_planeaciones.py — Seed DynamoDB with sample planeaciones.

Usage:
  python backend/populate_planeaciones.py [--clear]

Options:
  --clear   Delete all existing items before inserting (dev reset)

Each planeacion gets a `price` calculated automatically from its
`completeness_score` via calculate_individual_price().
"""

import argparse
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent))

import boto3
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from src.models.pricing import calculate_individual_price

REGION  = "us-east-1"
PROFILE = "consejotecnico"
TABLE   = "consejotecnico-planeaciones"

# ──────────────────────────────────────────────────────────────────────────────
# Planeaciones catalog (completeness_score drives price automatically)
# ──────────────────────────────────────────────────────────────────────────────

PLANEACIONES_DATA = [
    # ── Preescolar ──────────────────────────────────────────────────────────
    {
        "tema": "Lenguaje Oral",
        "grado": "Preescolar",
        "titulo": "Desarrollo del Lenguaje Oral en Preescolar",
        "descripcion": "Actividades lúdicas para estimular la expresión oral, vocabulario y comprensión en niños de preescolar.",
        "completeness_score": 0.85,
    },
    {
        "tema": "Matemáticas",
        "grado": "Preescolar",
        "titulo": "Nociones de Número y Cantidad",
        "descripcion": "Juegos y actividades para introducir los conceptos de número, cantidad y clasificación.",
        "completeness_score": 0.70,
    },
    {
        "tema": "Arte",
        "grado": "Preescolar",
        "titulo": "Expresión Plástica con Materiales del Entorno",
        "descripcion": "Exploración creativa con materiales naturales y reciclados para desarrollar la motricidad fina.",
        "completeness_score": 0.60,
    },
    # ── 1° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "1°",
        "titulo": "Sumas y Restas Básicas",
        "descripcion": "Introducción a las operaciones aritméticas con material concreto y pictórico.",
        "completeness_score": 0.60,
    },
    {
        "tema": "Español",
        "grado": "1°",
        "titulo": "Lectura Inicial: Sílabas y Palabras",
        "descripcion": "Estrategias fonológicas y visuales para el inicio de la lectoescritura en primer grado.",
        "completeness_score": 0.75,
    },
    {
        "tema": "Ciencias",
        "grado": "1°",
        "titulo": "Los Seres Vivos de Mi Entorno",
        "descripcion": "Exploración del entorno natural inmediato: plantas, animales e identificación de características.",
        "completeness_score": 0.55,
    },
    # ── 2° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "2°",
        "titulo": "Multiplicación como Suma Repetida",
        "descripcion": "Secuencia didáctica para construir el concepto de multiplicación usando materiales concretos.",
        "completeness_score": 0.80,
    },
    {
        "tema": "Español",
        "grado": "2°",
        "titulo": "Comprensión Lectora: Textos Narrativos",
        "descripcion": "Estrategias de comprensión para cuentos y fábulas con actividades de predicción e inferencia.",
        "completeness_score": 0.90,
    },
    {
        "tema": "Historia",
        "grado": "2°",
        "titulo": "Mi Familia y Mi Comunidad",
        "descripcion": "Reconocimiento de la historia personal y familiar como parte de la historia local.",
        "completeness_score": 0.65,
    },
    # ── 3° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "3°",
        "titulo": "Fracciones: Mitades, Tercios y Cuartos",
        "descripcion": "Introducción a las fracciones con material manipulativo y situaciones de la vida cotidiana.",
        "completeness_score": 0.85,
    },
    {
        "tema": "Español",
        "grado": "3°",
        "titulo": "Producción de Textos Descriptivos",
        "descripcion": "Guía para enseñar a los alumnos a describir personas, lugares y objetos con detalle.",
        "completeness_score": 0.95,
    },
    {
        "tema": "Ciencias",
        "grado": "3°",
        "titulo": "El Sistema Solar",
        "descripcion": "Exploración del sistema solar: planetas, movimientos y características con maquetas y videos.",
        "completeness_score": 1.00,
    },
    {
        "tema": "Geografía",
        "grado": "3°",
        "titulo": "Mi Estado en el Mapa de México",
        "descripcion": "Localización del estado en el mapa nacional, características geográficas y regiones.",
        "completeness_score": 0.70,
    },
    # ── 4° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "4°",
        "titulo": "Números Decimales en la Vida Cotidiana",
        "descripcion": "Uso de decimales en contextos reales: precios, medidas y cálculo de cambio.",
        "completeness_score": 0.88,
    },
    {
        "tema": "Español",
        "grado": "4°",
        "titulo": "Escritura de Noticias y Reportajes",
        "descripcion": "Proyecto de aula para redactar noticias escolares siguiendo la estructura periodística.",
        "completeness_score": 0.92,
    },
    {
        "tema": "Historia",
        "grado": "4°",
        "titulo": "La Conquista de México",
        "descripcion": "Secuencia sobre la conquista española: causas, actores y consecuencias para los pueblos originarios.",
        "completeness_score": 0.78,
    },
    {
        "tema": "Ciencias",
        "grado": "4°",
        "titulo": "La Materia y Sus Cambios",
        "descripcion": "Experimentos sencillos sobre estados de la materia, mezclas y cambios físicos y químicos.",
        "completeness_score": 0.82,
    },
    # ── 5° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "5°",
        "titulo": "Porcentajes y Proporcionalidad",
        "descripcion": "Resolución de problemas con porcentajes usando tablas de proporcionalidad y regla de tres.",
        "completeness_score": 0.90,
    },
    {
        "tema": "Español",
        "grado": "5°",
        "titulo": "El Texto Argumentativo",
        "descripcion": "Estrategias para identificar y escribir textos de opinión con argumentos y contraargumentos.",
        "completeness_score": 0.95,
    },
    {
        "tema": "Geografía",
        "grado": "5°",
        "titulo": "Diversidad Cultural de México",
        "descripcion": "Reconocimiento de la pluralidad cultural, lenguas indígenas y tradiciones regionales de México.",
        "completeness_score": 0.85,
    },
    {
        "tema": "Ciencias",
        "grado": "5°",
        "titulo": "El Cuerpo Humano: Sistemas y Aparatos",
        "descripcion": "Estudio de los principales sistemas del cuerpo humano con modelos y actividades de investigación.",
        "completeness_score": 1.00,
    },
    # ── 6° Primaria ──────────────────────────────────────────────────────────
    {
        "tema": "Matemáticas",
        "grado": "6°",
        "titulo": "Álgebra Introductoria: Ecuaciones Simples",
        "descripcion": "Introducción al pensamiento algebraico mediante ecuaciones con una incógnita y situaciones problema.",
        "completeness_score": 0.88,
    },
    {
        "tema": "Español",
        "grado": "6°",
        "titulo": "Proyecto de Lectura: Novela Juvenil",
        "descripcion": "Guía de lectura extensiva de una novela juvenil con círculos de lectura y diario de lectores.",
        "completeness_score": 0.93,
    },
    {
        "tema": "Historia",
        "grado": "6°",
        "titulo": "México en el Siglo XX",
        "descripcion": "Revolución Mexicana, gobiernos posrevolucionarios y transformaciones sociales del siglo XX.",
        "completeness_score": 0.97,
    },
    {
        "tema": "Ciencias",
        "grado": "6°",
        "titulo": "Ecosistemas y Biodiversidad",
        "descripcion": "Estudio de los principales ecosistemas de México, cadenas tróficas y problemas ambientales.",
        "completeness_score": 1.00,
    },
]

# ──────────────────────────────────────────────────────────────────────────────


def build_item(data: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    score = data["completeness_score"]
    price = calculate_individual_price(score)
    return {
        "planeacionId":       str(uuid.uuid4()),
        "tema":               data["tema"],
        "grado":              data["grado"],
        "titulo":             data["titulo"],
        "descripcion":        data["descripcion"],
        "completeness_score": str(score),   # DynamoDB Decimal-safe
        "price":              price,         # int, MXN
        "formats":            ["pdf", "docx", "pptx"],
        "rating":             0,
        "reviewCount":        0,
        "createdAt":          now,
        "updatedAt":          now,
    }


def clear_table(table) -> int:
    """Delete all items (dev reset). Returns count deleted."""
    scan = table.scan(ProjectionExpression="planeacionId")
    count = 0
    with table.batch_writer() as batch:
        for item in scan.get("Items", []):
            batch.delete_item(Key={"planeacionId": item["planeacionId"]})
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true",
                        help="Delete all existing items before inserting")
    args = parser.parse_args()

    session = boto3.Session(profile_name=PROFILE, region_name=REGION)
    table = session.resource("dynamodb").Table(TABLE)

    if args.clear:
        n = clear_table(table)
        print(f"Cleared {n} existing items.")

    print(f"Inserting {len(PLANEACIONES_DATA)} planeaciones...\n")

    with table.batch_writer() as batch:
        for data in PLANEACIONES_DATA:
            item = build_item(data)
            batch.put_item(Item=item)
            print(
                f"  [{item['grado']:12s}] {item['tema']:15s}  "
                f"score={data['completeness_score']:.2f}  "
                f"price=${item['price']} MXN  "
                f"-- {item['titulo']}"
            )

    print(f"\nDone. {len(PLANEACIONES_DATA)} planeaciones inserted into '{TABLE}'.")


if __name__ == "__main__":
    main()
