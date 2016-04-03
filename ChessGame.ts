import cp = require("./ChessPosition");
import ChessPosition = cp.ChessPosition
import Move = cp.Move;


interface GameMove {
  move : Move;
  nextMoves : Array<GameMove>;
  prevMove : GameMove;
  san : string;
}

export class Game {
  public position : ChessPosition;
  public move : GameMove;

  constructor () {
    this.position = new ChessPosition();
    this.move = { move : null, nextMoves : [], prevMove : null, san : "-" };
  }

  addMove (m : Move) {
    var gm : GameMove = {
      move : m,
      prevMove : this.move,
      nextMoves : [],
      san : this.position.moveToSAN(m)
    };

    var exists = this.move.nextMoves.filter(x => x.san == gm.san);

    if (exists.length > 0) { gm = exists[0]; }
    else { this.move.nextMoves.push(gm); }

    this.position.doMove(gm.move);
    this.move = gm;
  }

  addMoveSAN (s : string) {
    var m : Move = this.position.sanToMove(s);
    this.addMove(m);
  }

  prevMove() {
    if (this.move.prevMove) {
      this.position.undoMove(this.move.move);
      this.move = this.move.prevMove;
    }
  }
}
