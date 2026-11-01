# PDF preview runtime

Mozilla PDF.js / pdfjs-dist 6.4.299, Apache-2.0. See LICENSE.
Source: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
Package SHA-512 integrity was verified against its versioned npm registry metadata before copying these runtime assets.
Only build/pdf.mjs, build/pdf.worker.mjs, cmaps, standard_fonts and wasm runtime dependencies are included. No source timetable PDFs or extracted data are distributed here.

The administrative preview loads these assets from this same website, supplies selected PDF bytes directly to the local worker, and draws pages onto a canvas. It does not use a third-party viewer, annotation/link layer, cloud OCR or upload endpoint.
