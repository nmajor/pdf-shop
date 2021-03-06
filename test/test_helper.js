import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';

import chai from 'chai';
import chaiAlmost from 'chai-almost';

chai.use(chaiAlmost(0.002));

const bucket = 'pdf-shop-uploads';

export function deleteTestObjects() {
  return new Promise((resolve, reject) => {
    let params = {
      Bucket: bucket,
      Prefix: 'test/',
    };
    const s3 = new AWS.S3();

    return s3.listObjects(params, (err, data) => {
      if (err) return reject(err);

      if (data.Contents.length === 0) resolve();

      params = { Bucket: bucket };
      params.Delete = { Objects: [] };

      data.Contents.forEach((content) => {
        params.Delete.Objects.push({ Key: content.Key });
      });

      return s3.deleteObjects(params, (err) => { // eslint-disable-line no-shadow
        if (err) return reject(err);
        return resolve();
      });
    });
  });
}

export function clearResultsFiles() {
  return new Promise((resolve, reject) => {
    const directory = 'test/results';
    fs.readdir(directory, (err, files) => {
      if (err) reject(err);

      files.forEach((file) => {
        fs.unlinkSync(path.join(directory, file));
      });

      resolve();
    });
  });
}

// eslint-disable-next-line func-names
before((done) => {
  deleteTestObjects()
    .then(clearResultsFiles)
    .then(done)
    .catch(err => console.error(err));
});

export default null;
