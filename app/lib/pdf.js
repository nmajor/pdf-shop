import _ from 'lodash';
import fs from 'fs';
import pdf from 'html-pdf';
import pdfjs from 'pdfjs-dist';
import crypto from 'crypto';

import options from '../options';
import * as latex from './latex';

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
        heightIn: `${_.round((height / 72), 3)}in`,
        widthIn: `${_.round((width / 72), 3)}in`,
      };
    });
}

export function metaFromFile(file) {
  return new Promise((resolve, reject) => fs.readFile(file, (err, buffer) => {
    if (err) reject(err);

    return resolve(metaFromBuffer(buffer));
  }));
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
      phantomPath: 'phantomjs',
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
  return new Promise((resolve) => {
    if (typeof data === 'string') {
      return metaFromFile(data)
        .then(meta => resolve({ file: data, meta }));
    }

    return metaFromBuffer(data)
      .then(meta => resolve({ buffer: data, meta }));
  });
}

export function addPageNumbers(pdfObj) {
  return latex.pageNumbering(pdfObj.file, pdfObj.meta)
    .then(toPdfObj);
}

export function addBlankPage(pdfObj) {
  return latex.appendBlankPage(pdfObj.file, pdfObj.meta)
    .then(toPdfObj);
}

export function addGutterMargins(pdfObj) {
  return latex.gutterMargins(pdfObj.file, pdfObj.meta)
    .then(toPdfObj);
}

export default null;
