const vm = require('vm');
const fs = require('fs');
const _ = require('lodash');

const REG_SCRIPT = /<script src="([^><]+\/(main\.\w+\.js))\?t=\d+">/gm;
const REG_ENTRY = /^(.*?\.push\(\[)(\d+,\d+)/;
const KEYWORD_MODULE = 'get_risk_result:';

// js存储
const cacheJsContent = {};

/**
 * @description 加密专用
 */
class FakerSmashUtils {
  constructor(api, indexUrl, data = {}) {
    this.api = api;
    this.indexUrl = indexUrl;
    const {userAgent, smashInitData} = data;
    this.userAgent = userAgent || '';
    this.smashInitData = smashInitData || {};
  }

  async init() {
    const html = await this.httpGet(this.indexUrl);
    const script = REG_SCRIPT.exec(html);
    if (script) {
      const [, scriptUrl, filename] = script;
      const jsContent = await this.getJSContent(filename, scriptUrl);
      const ctx = {
        window: {addEventListener: _.noop},
        document: {
          addEventListener: _.noop,
          removeEventListener: _.noop,
          cookie: '',
        },
        navigator: {userAgent: this.userAgent || ''},
      };

      vm.createContext(ctx);
      vm.runInContext(jsContent, ctx);

      this.smashUtils = ctx.window.smashUtils;
      this.smashUtils.init(this.smashInitData);
    }
  }

  async getJSContent(cacheKey, url) {
    if (cacheJsContent[cacheKey]) return cacheJsContent[cacheKey];

    let jsContent = await this.httpGet(url);
    const findEntry = REG_ENTRY.test(jsContent);
    const ctx = {
      moduleIndex: 0,
    };
    const injectCode = `moduleIndex=arguments[0].findIndex(s=>s&&s.toString().indexOf('${KEYWORD_MODULE}')>0);return;`;
    const injectedContent = jsContent.replace(/^(!function\(\w\){)/, `$1${injectCode}`);

    vm.createContext(ctx);
    vm.runInContext(injectedContent, ctx);

    if (!(ctx.moduleIndex && findEntry)) {
      throw new Error('Module not found.');
    }
    jsContent = jsContent.replace(REG_ENTRY, `$1${ctx.moduleIndex},1`);
    // Fix device info (actually insecure, make less sense)
    jsContent = jsContent.replace(/\w+\.getDefaultArr\(7\)/, '["a","a","a","a","a","a","1"]');
    cacheJsContent[cacheKey] = jsContent;
    // fs.writeFile(cacheKey, jsContent);
    return jsContent;
  }

  async run(id, data = {}) {
    if (!this.smashUtils) {
      await this.init();
    }

    const random = Math.floor(1e+6 * Math.random()).toString().padEnd(6, '8');
    const {log} = this.smashUtils.get_risk_result({
      id,
      data: {
        ...data,
        pin: this.api.getPin(),
        random,
      },
    });
    return {
      ...data,
      random,
      extraData: {log, sceneid: this.smashInitData.sceneid},
    };
  }

  // 直接替换api对应方法
  patchApi(needEncryptIds) {
    const api = this.api;
    const doFormBody = api.doFormBody;
    api.doFormBody = async (...args) => {
      const [functionId, body, ...others] = args;
      const id = needEncryptIds.find(str => functionId.match(str));
      if (id) return doFormBody.call(api, functionId, await this.run(id, body), ...others);
      return doFormBody.apply(api, args);
    };
  }

  async httpGet(uri) {
    !/^http(s)+/.test(uri) && (uri = `https:${uri}`);
    return this.api.commonDo({
      uri,
      headers: {
        Cookie: '',
      },
      method: 'GET',
    });
  }
}

module.exports = FakerSmashUtils;
