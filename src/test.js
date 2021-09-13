const _ = require('lodash');
const {getNowDate, getNowHour} = require('./lib/moment');
const {sleep} = require('./lib/common');
const {getCookieData, updateProcessEnv} = require('./lib/env');
updateProcessEnv();
const {
  multipleRun,
  serialRun,
  doRun,
  doRun1,
  doCron,
  doCron1,
  TemporarilyOffline,
  sendNotify,
} = require('./api');

const Joy = require('./jd/joy');

const nowDate = getNowDate();
const nowHour = getNowHour();

main().then(sendNotify.bind(0, {
  subjects: ['lazy_script_test', nowDate, nowHour],
}));

async function main() {
  await doRun(Joy);
}
