module.exports = {
  // encodes a Buffer into a byteA encoded string suitable for pg module
  encodeByteA: function(buf) {
    if (buf === null) {
      return null;
    }
    var s = '';
    var len = buf.length;
    for (var i = 0; i < len; i++) {
      var byte = buf[i];
      if (byte === 0x5c) {
        s += "\\\\";
      } else if (byte > 31 && byte < 127) {
        s += String.fromCharCode(byte);
      } else {
        var octal = byte.toString(8);
        if (octal.length === 1) {
          octal = "00"+octal;
        } else if (octal.length ===2) {
          octal = "0"+octal;
        }
        s += "\\" + octal;
      }
    }
    return s;
  },

  // creates a buffer from an byteA encoded string
  decodeByteA: function(str) {
    return new Buffer(str.replace(/\\([0-7]{3})/g, function (full_match, code) {
      return String.fromCharCode(parseInt(code, 8));
    }).replace(/\\\\/g, "\\"), "binary");
  }
};

// for future use?
// function stringToBytesFaster(str) { 
//   var ch, st, re = [], j=0;
//   for (var i = 0; i < str.length; i++ ) {
//     ch = str.charCodeAt(i);
//     if (ch < 127) {
//       re[j++] = ch & 0xFF;
//     } else {
//       st = [];    // clear stack
//       do {
//         st.push( ch & 0xFF );  // push byte to stack
//         ch = ch >> 8;          // shift value down by 1 byte
//       } while ( ch );
//       // add stack contents to result
//       // done because chars have "wrong" endianness
//       st = st.reverse();
//       for(var k=0; k<st.length; ++k) {
//         re[j++] = st[k];
//       }
//     }
//   }
//   // return an array of bytes
//   return re; 
// }
