import cg = require("./ChessGame")
import Game = cg.Game;

interface ParseState {
  s : string;
  pos : number;
  token : Token;
}

interface Token {
  type : "Tag" | "NewLine" | "Text" | "EOF";
  data? : string;
}

function nextToken(state : ParseState) : ParseState {
  var s = state.s;
  var slength = s.length;
  var pos = state.pos;
  var newState = { s : state.s, pos : null , token : null };
  var token : Token = null;
  var c;

  var nextChar = () => {
    if (s[pos] == "\n" && s[pos+1] == "\n") {
      pos += 2; c = "newline"
    } else if (pos >= slength) { c = "eof"; }
    else { c = s[pos]; pos+=1; }
  }

  var unpush = c => {
    if (c == "newline") pos -= 2;
    else pos -= 1;
  }

  nextChar();
  while (c == " " || c == "\n") nextChar();

  if (c == "newline") {
    token = { type : "NewLine" }
  } else if(c == "[") {
    while(c !== "]" && c !== "newline" && c !== "eof") nextChar();
    token = { type : "Tag" };
  } else if (c == "eof") {
    token = { type : "EOF" };
  } else {
    var data = "";
    while (c !== "newline" && c !== "eof" && c !== " ") {
      if (c !== "\n") data += c;
      nextChar();
    }
    unpush(c);
    token = { type : "Text", data : data };
  }

  newState.pos = pos;
  newState.token = token;

  return newState;
}

function isResult (s : string) {
  return ["1-0", "0-1", "1/2-1/2", "*"].indexOf(s) >= 0;
}

function stripDot (s : string) {
  var p = s.indexOf(".");
  if (p == -1) return s;
  return s.slice(p+1);
}

export function parseOnePgnGame(s : string) : Array<Game> {
  var state : ParseState = { s : s, pos : 0, token : null };
  var games : Array<Game> = [];
  var curGame = new Game();
  var section : "Headers" | "Moves" = "Headers";

  state = nextToken(state);
  while (state.token.type !== "EOF") {
    if (section == "Headers")
    {
      while (state.token.type !== "NewLine" && state.token.type !== "EOF") state = nextToken(state);
      state = nextToken(state);
      section = "Moves";
    } else {
      while (state.token.type !== "NewLine" && state.token.type !== "EOF") {
        if (state.token.type == "Text") {
          if (!isResult(state.token.data)) {
            var sanMove = stripDot(state.token.data);
            //try {
              curGame.addMoveSAN(sanMove);
            //} catch(e) {
            //  console.log("Warning: ", e)
            //}
          }
        }
        state = nextToken(state);
      }
      games.push(curGame);
      curGame = new Game();
      section = "Headers";
    }
  }

  return games;
}
