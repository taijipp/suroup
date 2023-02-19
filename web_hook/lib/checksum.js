'use strict';
const _ = require('lodash');
const byteToHexString = (uint8arr) => { // {{{
  if (!uint8arr) {
    return '';
  }
  
  var hexStr = '';
  for (var i = 0; i < uint8arr.length; i++) {
    var hex = (uint8arr[i] & 0xff).toString(16);
    hex = (hex.length === 1) ? '0' + hex : hex;
    hexStr += hex;
  }
  
  return hexStr.toUpperCase();
} // }}}

const hexStringToByte = (str) => { // {{{
  if (!str) {
    return new Uint8Array();
  }
  
  var a = [];
  for (var i = 0, len = str.length; i < len; i+=2) {
    a.push(parseInt(str.substr(i,2),16));
  }
  
  return new Uint8Array(a);
} // }}}

const hex2bin = (hex, pad=8)=>_.padStart((parseInt(hex, 16)>>>0).toString(2), pad, '0');

const xorsum = (hexString) => { // {{{
	let data = hexStringToByte(hexString);
	let xor = 0;
	for(let i = 0, max = data.length ; i < max; i++){
		xor ^= data[i];
	}

	return _.padStart(xor.toString(16), 2, '0');
} // }}}

const addsum = (hexString) => { // {{{
	let data = hexStringToByte(hexString);
	let add = 0;
	for(let i = 0, max = data.length ; i < max; i++){
		add += data[i];
		add = ( add & 0xFF );
	}
//	let result = add.toString(16);
//    	result = (result.length === 1) ? '0' + result : result;
	return _.padStart(add.toString(16), 2, '0');
} // }}}


const orsum = (hexString) => { // {{{
	let data = hexStringToByte(hexString);
	let or = 0;
	for(let i = 0, max = data.length ; i < max; i++){
		or |= data[i];
	}
	return _.padStart(or.toString(16), 2, '0');
} // }}}

module.exports = { xorsum, addsum, orsum, hexStringToByte, byteToHexString, hex2bin };
