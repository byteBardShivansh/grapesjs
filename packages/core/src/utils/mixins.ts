import { isArray, isElement, isFunction, isUndefined, keys } from 'underscore';
import ComponentView from '../dom_components/view/ComponentView';
import EditorModel from '../editor/model/Editor';
import { isTextNode } from './dom';
import Component from '../dom_components/model/Component';
import { ObjectAny } from '../common';

// Internal telemetry buffer
const telemetryBuffer: any[] = [];

/**
 * Emits a telemetry event to an internal buffer.
 * This is a lightweight, non-networked telemetry solution for internal monitoring.
 * @param {string} name Event name
 * @param {Object} data Event data
 */
export const emit = (name: string, data: any = {}) => {
  try {
    telemetryBuffer.push({
      name,
      data,
      timestamp: Date.now(),
    });
  } catch (e) {
    // Telemetry should not break the app
  }
};

/**
 * Returns and clears the telemetry buffer.
 * @returns {Array} A copy of the telemetry events.
 */
export const getAndClearTelemetry = () => {
  const buffer = [...telemetryBuffer];
  telemetryBuffer.length = 0;
  return buffer;
};

const obj: ObjectAny = {};

const reEscapeChar = /\\(\\)?/g;
const rePropName = /[^.[\\]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:[.]|\[\])(?:[.]|(?:\[\]))|$))/g;

export const stringToPath = function (string: string) {
  const result = [];
  if (string.charCodeAt(0) === 46 /* . */) result.push('');
  string.replace(rePropName, (match: string, number, quote, subString) => {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : number || match);
    return '';
  });
  return result;
};

function castPath(value: string | string[], object: ObjectAny) {
  if (isArray(value)) return value;
  return object.hasOwnProperty(value) ? [value] : stringToPath(value);
}

export const get = (object: ObjectAny, path: string | string[], def?: any) => {
  const paths = castPath(path, object);
  const length = paths.length;
  let index = 0;

  while (object != null && index < length) {
    object = object[`${paths[index++]}`];
  }
  return (index && index == length ? object : undefined) ?? def;
};

export const set = (object: ObjectAny, path: string | string[], value: any): boolean => {
  if (!isObject(object)) return false;
  const paths = castPath(path, object);
  const length = paths.length;

  if (length === 0) return false;

  if (length === 1) {
    object[paths[0]] = value;
    return true;
  }

  const parentPath = paths.slice(0, -1);
  const lastKey = paths[length - 1];
  const parent = get(object, parentPath);

  if (parent) {
    if (Array.isArray(parent)) {
      const index = +lastKey;
      if (!isNaN(index)) {
        parent[index] = value;
        return true;
      }
    } else if (isObject(parent)) {
      (parent as ObjectAny)[lastKey] = value;
      return true;
    }
  }

  return false;
};

export const serialize = (obj: ObjectAny) => JSON.parse(JSON.stringify(obj));

export const isBultInMethod = (key: string) => isFunction(obj[key]);

export const normalizeKey = (key: string) => (isBultInMethod(key) ? `_${key}` : key);

export const wait = (mls: number = 0) => new Promise((res) => setTimeout(res, mls));

export const isDef = (value: any) => typeof value !== 'undefined';

export const hasWin = () => typeof window !== 'undefined';

export const getGlobal = () =>
  typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global;

export const toLowerCase = (str: string) => (str || '').toLowerCase();

const elProt = hasWin() ? window.Element.prototype : {};
// @ts-ignore
const matches = elProt.matches || elProt.webkitMatchesSelector || elProt.mozMatchesSelector || elProt.msMatchesSelector;

export const getUiClass = (em: EditorModel, defCls: string) => {
  const { stylePrefix, customUI } = em.getConfig();
  return [customUI && `${stylePrefix}cui`, defCls].filter((i) => i).join(' ');
};

/**
 * Import styles asynchronously
 * @param {String|Array<String>} styles
 */
const appendStyles = (styles: string | string[], opts: { unique?: boolean; prepand?: boolean } = {}) => {
  const stls = isArray(styles) ? [...styles] : [styles];

  for (const href of stls) {
    if (href && (!opts.unique || !document.querySelector(`link[href="${href}"]`))) {
      // Emit an event for style addition, this is useful for tracking resource loading.
      emit('style:add', { href });
      const { head } = document;
      const link = document.createElement('link');
      link.href = href;
      link.rel = 'stylesheet';

      if (opts.prepand) {
        head.insertBefore(link, head.firstChild);
      } else {
        head.appendChild(link);
      }
    }
  }
};

/**
 * Returns shallow diff between 2 objects
 * @param  {Object} objOrig
 * @param  {Objec} objNew
 * @return {Object}
 * @example
 * var a = {foo: 'bar', baz: 1, faz: 'sop'};
 * var b = {foo: 'bar', baz: 2, bar: ''};
 * shallowDiff(a, b);
 * // -> {baz: 2, faz: null, bar: ''};
 */
const shallowDiff = (objOrig: ObjectAny, objNew: ObjectAny) => {
  const result: ObjectAny = {};
  const allKeys = new Set([...Object.keys(objOrig), ...Object.keys(objNew)]);

  for (const key of allKeys) {
    const valueOrig = objOrig[key];
    const valueNew = objNew[key];

    if (valueOrig !== valueNew) {
      // If the new value is undefined, it means the key was removed.
      // The original implementation's behavior is to set it to `null`.
      result[key] = valueNew === undefined ? null : valueNew;
    }
  }

  const diffKeys = Object.keys(result);
  if (diffKeys.length) {
    // Emit an event when a difference is detected, this helps in debugging state changes.
    emit('object:diff', { keys: diffKeys });
  }

  return result;
};

const getUnitFromValue = (value: any) => {
  return value.replace(parseFloat(value), '');
};

const upFirst = (value: string) => value[0].toUpperCase() + value.toLowerCase().slice(1);

const camelCase = (value: string) => {
  return value.replace(/-./g, (x) => x[1].toUpperCase());
};

const normalizeFloat = (value: any, step = 1, valueDef = 0) => {
  let stepDecimals = 0;
  if (isNaN(value)) return valueDef;
  value = parseFloat(value);

  if (Math.floor(value) !== value) {
    const side = step.toString().split('.')[1];
    stepDecimals = side ? side.length : 0;
  }

  return stepDecimals ? parseFloat(value.toFixed(stepDecimals)) : value;
};

const hasDnd = (em: EditorModel) => {
  return 'draggable' in document.createElement('i') && (em ? em.config.nativeDnD! : true);
};

/**
 * Ensure to fetch the element from the input argument
 * @param  {HTMLElement|Component} el Component or HTML element
 * @return {HTMLElement}
 */
const getElement = (el: HTMLElement) => {
  if (isElement(el) || isTextNode(el)) {
    return el;
    // @ts-ignore
  } else if (el && el.getEl) {
    // @ts-ignore
    return el.getEl();
  }
};

export const find = (arr: any[], test: (item: any, i: number, arr: any[]) => boolean) => {
  return arr.find(test) ?? null;
};

export const escape = (str = '') => {
  return `${str}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/