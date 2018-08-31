import fs from 'fs';
import pdf from 'html-pdf';
import path from 'path';
import pdfjs from 'pdfjs-dist';
import crypto from 'crypto';

import options from '../options';

import * as download from './download';

function phantomPath() {
  return process.env.LAMBDA_TASK_ROOT ? path.resolve(process.env.LAMBDA_TASK_ROOT, 'bin/phantomjs') : undefined;
}

export function bufferToSha1(buffer) {
  const hash = crypto.createHash('sha1');
  hash.update(buffer);
  return hash.digest('hex');
}

export function metaFromBuffer(buffer) {
  let meta = {};
  return pdfjs.getDocument(buffer).then((doc) => {
    meta = {
      ...meta,
      pageCount: doc.pdfInfo.numPages,
      sha1: bufferToSha1(buffer),
      size: buffer.byteLength,
    };

    return doc.getPage(1);
  })
    .then((page) => {
      const [x, y, w, h] = page.pageInfo.view;
      const width = (w - x);
      const height = (h - y);

      return {
        ...meta,
        height,
        width,
        heightIn: `${height / 72}in`,
        widthIn: `${width / 72}in`,
      };
    });
}

function saveFile(file, buffer) {
  return new Promise((resolve, reject) => {
    fs.writeFile(file, buffer, (err) => {
      if (err) return reject(err);

      return resolve(file);
    });
  });
}

export function toBuffer(html) {
  return new Promise((resolve, reject) => {
    pdf.create(html, {
      phantomPath: phantomPath(),
      timeout: 120000,
      height: options.get().height,
      width: options.get().width,
      border: {
        top: options.get().margin,
        right: options.get().margin,
        bottom: options.get().margin,
        left: options.get().margin,
      },
    }).toBuffer((err, buffer) => {
      if (err) return reject(err);

      return resolve(buffer);
    });
  });
}

export function toFile(html, file) {
  return toBuffer(html, options)
    .then(results => saveFile(file, results));
}

export function toPdfObj(data) {
  return new Promise((resolve, reject) => {
    if (typeof data === 'string') {
      return fs.readFile(data, (err, buffer) => {
        if (err) reject(err);

        return metaFromBuffer(buffer)
          .then(meta => resolve({ file: data, meta }));
      });
    }

    return metaFromBuffer(data)
      .then(meta => resolve({ buffer: data, meta }));
  });
}

export function pagifyFile(pdfFile, startingPage) {
  const latexTemplatePath = `${__dirname}../../latex/page_numbering.tex`;
  const latexPath = `${download.dir}/page_numbering.tex`;

  return toPdfObj(pdfFile)
    .then((pdfObj) => {
      const latexTemplateText = fs.readFileSync(latexTemplatePath, 'utf8');

      const latexText = latexTemplateText
        .replace('STARTING_PAGE', startingPage)
        .replace('FOOTER_POSITIONS', this.getFooterPositions(startingPage))
        .replace('PDF_PATH', pdfFile)
        .replace('PDF_HEIGHT', pdfObj.meta.heightIn)
        .replace('PDF_WIDTH', pdfObj.meta.widthIn)
        .replace('LEFT_MARGIN', options.get().margin)
        .replace('RIGHT_MARGIN', options.get().margin);

      fs.writeFileSync(latexPath, latexText);
      return '';
    });
}

export default null;
