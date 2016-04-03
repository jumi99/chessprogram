type Piece = 'p' | 'r' | 'n' | 'b' | 'q' | 'k' | 'P' | 'R' | 'N' | 'B' | 'Q' | 'K'
type Color = 'W' | 'B';

interface Square {
  file : number;
  rank : number;
}

interface CastlingFlags {
  whiteKing : boolean;
  whiteQueen: boolean;
  blackKing : boolean;
  blackQueen: boolean;
}

export interface Move {
  source : Square;
  target : Square;
  capturedPiece : Piece;
  promote : Piece;
  captureSquare : Square ; //If en-passant
  castlingFlags : CastlingFlags;
  epSquare : Square;
  halfMoveClock : number;
}

function pieceColor (p : Piece) : Color {
  if (!p) return null;
  return (p.toUpperCase() == p) ? "W" : "B";
}

export class ChessPosition {
  private halfMoveClock : number;
  private plyCount : number;
  private board : Array<Array<Piece>>; // positon 0,0 is A1
  public castlingFlags  : CastlingFlags;
  private sideToMove : Color;
  private epTarget : Square;
  
  constructor ()
  {
    this.resetBoard();
    this.fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 0");
  }

  resetBoard () : void
  {
    this.halfMoveClock = 0;
    this.plyCount = 0;
    this.board = [[],[],[],[],[],[],[],[]];
    this.castlingFlags = this.defaultCastlingFlags();
    this.sideToMove = 'W';
    this.epTarget = null;
  }

  defaultCastlingFlags () : CastlingFlags
  {
    return { whiteKing : true, whiteQueen : true, blackKing : true, blackQueen : true };
  }

  fromFEN (s : string) : void
  {
    this.resetBoard();

    var stringPosition = 0;
    var file = 0;
    var rank = 7;
    var numsquares=0;

    // Parse piece position
    while(numsquares < 64)
    {
      var c = s[stringPosition];
      if (c == '/')
      {
        if (file != 0) throw new Error("Bad FEN string");
      }
      else if (c > '0' && c < '9')
      {
        var n = parseInt(c);
        file += n;
        numsquares += n;
      }
      else
      {
        //TODO: Check that is a valid king
        var p = <Piece>c;
        this.placePiece(p, { file : file, rank : rank });
        file += 1;
        numsquares += 1;
      }
      stringPosition += 1;

      while (file > 7) { file -= 8; rank -= 1; }
    }
    //TODO: Check that is a valid position

    // Parse side to move
    while(s[stringPosition] == " ") stringPosition++;
    switch(s[stringPosition]) {
      case 'w': this.sideToMove = "W"; break;
      case 'b': this.sideToMove = "B"; break;
      default: throw new Error("Bad FEN string");
    }

    stringPosition++;

    // Parse castling flags
    while(s[stringPosition] == " ") stringPosition++;

    this.castlingFlags = { whiteKing : false, whiteQueen : false, blackKing : false, blackQueen : false };

    if(s[stringPosition] == "-")
    {
      stringPosition++;
    }
    else if (stringPosition == s.length)
    {
      this.castlingFlags = this.defaultCastlingFlags();
      return;
    }
    else
    {

      while(stringPosition < s.length && s[stringPosition] != " ") {
        switch (s[stringPosition])
        {
          case 'K': this.castlingFlags.whiteKing = true; break;
          case 'Q': this.castlingFlags.whiteQueen = true; break;
          case 'k': this.castlingFlags.blackKing = true; break;
          case 'q': this.castlingFlags.blackQueen = true; break;
          default: throw new Error("Bad FEN string");
        }
        stringPosition++;
      }
    }

    // Parse EP target
    while(s[stringPosition] == " ") stringPosition++;
    if (stringPosition == s.length) return;

    if(s[stringPosition] == "-")
      stringPosition++;
    else
    {
      var fileChar = s[stringPosition];
      var rankChar = s[stringPosition+1];
      stringPosition+=2;
      if (fileChar < 'a' || fileChar > 'h') throw new Error("Bad FEN String");
      if (rankChar < '1' || rankChar > '8') throw new Error("Bad FEN String");
      this.epTarget = { file : fileChar.charCodeAt(0) - 'a'.charCodeAt(0), rank : rankChar.charCodeAt(0) - '1'.charCodeAt(0) };
    }

    // Parse half move clock
    while(s[stringPosition] == " ") stringPosition++;
    if (stringPosition == s.length) return;

    this.halfMoveClock = parseInt(s.slice(stringPosition), 10);
    while(s[stringPosition] != " " && stringPosition < s.length) stringPosition++;

    // Parse ply count
    while(s[stringPosition] == " ") stringPosition++;
    if (stringPosition == s.length) return;

    var ply = (parseInt(s.slice(stringPosition), 10) - 1) * 2;
    if (this.sideToMove == "B") ply++;
    this.plyCount = ply;

    while(s[stringPosition] != " " && stringPosition < s.length) stringPosition++;
    while(s[stringPosition] == " ") stringPosition++;
    if (stringPosition !== s.length) throw new Error("Bad FEN String");
  }

  
  // Generates all legal squares a piece can go without checking if
  // it leaves the king in check
  preLegalMovesSquare (square : Square, noCastling? : boolean) : Array<Move> {
    var moves : Array<Move> = [];
    var piece : Piece = this.board[square.file][square.rank];
    if (!piece) return [];

    var color : Color = pieceColor(piece);
    var otherColor : Color = color == "W" ? "B" : "W";
    var pieceType : Piece = <Piece>piece.toUpperCase();
    var slidingDirections : Array<[number,number]> = [];

    var validTarget = (x,y) : Move => {
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      var targetPiece = this.board[x][y];
      var targetColor = pieceColor(targetPiece);
      if (targetPiece && targetColor == color) return null;
      return { source : { file : square.file, rank : square.rank }
             , target : { file : x, rank : y }
             , capturedPiece : this.board[x][y]
             , captureSquare : null
             , promote : null
             , castlingFlags : this.cloneCastlingFlags()
             , epSquare : this.epTarget
             , halfMoveClock : this.halfMoveClock
             };
    }

    if (['R', 'Q'].indexOf(pieceType) >= 0)
      slidingDirections = slidingDirections.concat([[-1, 0], [1, 0], [0, -1], [0, 1]]);
    if (['B', 'Q'].indexOf(pieceType) >= 0)
      slidingDirections = slidingDirections.concat([[-1, -1], [-1, 1], [1, -1], [1, 1]]);

    slidingDirections.forEach(direction => {
      var position = [square.file, square.rank];
      var cont = true;

      while (cont) {
        position = [position[0] + direction[0], position[1] + direction[1]];
        var okPosition = validTarget(position[0], position[1]);
        if (okPosition) moves.push(okPosition);
        var cont = okPosition && !this.board[position[0]][position[1]];
      }
    });

    var displacements : Array<[number,number]> = [];
    if (pieceType == "N")
      displacements = [[-1,-2], [-2,-1], [-2, 1], [-1,2], [1,2], [2,1], [2,-1], [1, -2]];

    if (pieceType == "K")
      displacements = [[-1, 0], [-1,1], [0,1], [1,1], [1,0], [1,-1], [0,-1], [-1, -1]];

    displacements.forEach(direction => {
      var position = [square.file + direction[0], square.rank + direction[1]];
      var okPosition = validTarget(position[0],position[1]);
      if (okPosition) moves.push(okPosition);
    });

    if (!noCastling)
    {
      if (pieceType == "K" && square.file == 4 && (color == "W" && square.rank == 0 || color == "B" && square.rank == 7))
      {
        //KingSide castling
        if (color == "W" && this.castlingFlags.whiteKing || color == "B" && this.castlingFlags.blackKing) {
          if ( !this.board[square.file+1][square.rank] && !this.board[square.file+2][square.rank]
               && !this.attackedSquare({ file : square.file, rank : square.rank }, otherColor)
               && !this.attackedSquare({ file : square.file+1, rank : square.rank }, otherColor)
               && !this.attackedSquare({ file : square.file+2, rank : square.rank }, otherColor)
             )
          {
            moves.push({ source : { file : square.file, rank : square.rank }
                       , target : { file : square.file+2, rank : square.rank }
                       , capturedPiece : null
                       , promote : null
                       , captureSquare : null
                       , castlingFlags : this.cloneCastlingFlags()
                       , epSquare : this.epTarget
                       , halfMoveClock : this.halfMoveClock
                       });
          }
        }


        //QueenSide castling
        if (color == "W" && this.castlingFlags.whiteQueen || color == "B" && this.castlingFlags.blackQueen
            && !this.attackedSquare({ file : square.file, rank : square.rank }, otherColor)
            && !this.attackedSquare({ file : square.file-1, rank : square.rank }, otherColor)
            && !this.attackedSquare({ file : square.file-2, rank : square.rank }, otherColor)
           ) {
          if (!this.board[square.file-1][square.rank] && !this.board[square.file-2][square.rank])
          {
            moves.push({ source : { file : square.file, rank : square.rank }
                       , target : { file : square.file-2, rank : square.rank }
                       , capturedPiece : null
                       , promote : null
                       , captureSquare : null
                       , castlingFlags : this.cloneCastlingFlags()
                       , epSquare : this.epTarget
                       , halfMoveClock : this.halfMoveClock
                       });
          }
        }
      }
    }

    // Pawn
    if (pieceType == "P")
    {
      var direction = color == "W" ? 1 : -1;

      // Single square non-capturing
      if (!this.board[square.file][square.rank + direction])
      {
        //Promotion
        if (color == "W" && square.rank == 6 || color == "B" && square.rank == 1)
        {
          ["R", "N", "B", "Q"].forEach((promoPiece : Piece) =>
             {
               moves.push({ source : { file : square.file, rank : square.rank }
                          , target : { file : square.file, rank : square.rank + direction}
                          , capturedPiece : null
                          , promote : color == "W" ? promoPiece : <Piece>promoPiece.toLowerCase()
                          , captureSquare : null
                          , castlingFlags : this.cloneCastlingFlags()
                          , epSquare : this.epTarget
                          , halfMoveClock : this.halfMoveClock
                          });
             });
        }
        else
          moves.push({ source : { file : square.file, rank : square.rank }
                     , target : { file : square.file, rank : square.rank + direction }
                     , capturedPiece : null
                     , promote : null
                     , captureSquare : null
                     , castlingFlags : this.cloneCastlingFlags()
                     , epSquare : this.epTarget
                     , halfMoveClock : this.halfMoveClock
                     });
      }

      // Double square
      if ((color == "W" && square.rank == 1 || color == "B" && square.rank == 6))
      {
        if (!this.board[square.file][square.rank + 2 * direction] && !this.board[square.file][square.rank + direction])
        {
          moves.push({ source : { file : square.file, rank : square.rank }
                     , target : { file : square.file, rank : square.rank + 2 * direction }
                     , capturedPiece : null
                     , promote : null
                     , captureSquare : null
                     , castlingFlags : this.cloneCastlingFlags()
                     , epSquare : this.epTarget
                     , halfMoveClock : this.halfMoveClock
                     });
        }
      }

      // Capture
      for (var i = -1; i <=1; i += 2)
      {
        var targetFile = square.file + i;
        if (targetFile >= 0 && targetFile <= 7)
        {
          if (this.board[targetFile][square.rank + direction] && pieceColor(this.board[targetFile][square.rank + direction]) != color)
          {
            //Promotion
            if (color == "W" && square.rank == 6 || color == "B" && square.rank == 1)
            {
              ["R", "N", "B", "Q"].forEach((promoPiece : Piece) =>
                 {
                   moves.push({ source : { file : square.file, rank : square.rank }
                              , target : { file : targetFile, rank : square.rank + direction}
                              , capturedPiece : this.board[targetFile][square.rank + direction]
                              , promote : color == "W" ? promoPiece : <Piece>promoPiece.toLowerCase()
                              , captureSquare : null
                              , castlingFlags : this.cloneCastlingFlags()
                              , epSquare : this.epTarget
                              , halfMoveClock : this.halfMoveClock
                              });
                 });
            }
            else
              moves.push({ source : { file : square.file, rank : square.rank }
                         , target : { file : targetFile, rank : square.rank + direction}
                         , capturedPiece : this.board[targetFile][square.rank + direction]
                         , promote : null
                         , captureSquare : null
                         , castlingFlags : this.cloneCastlingFlags()
                         , epSquare : this.epTarget
                         , halfMoveClock : this.halfMoveClock
                         });
          }

          // En passant
          if (this.epTarget && this.epTarget.file == targetFile && this.epTarget.rank == square.rank + direction)
          {
            moves.push({ source : { file : square.file, rank : square.rank }
                       , target : { file : targetFile, rank : square.rank + direction}
                       , capturedPiece : this.board[targetFile][square.rank + 2 * direction]
                       , promote : null
                       , captureSquare : { file : targetFile, rank : square.rank + 2 * direction }
                       , castlingFlags : this.cloneCastlingFlags()
                       , epSquare : this.epTarget
                       , halfMoveClock : this.halfMoveClock
                       });
          }
        }
      }
    }

    return moves;
  }

  inCheck (color : Color) {
    var king : Piece = color == "W" ? "K" : "k";
    var otherColor : Color = color == "W" ? "B" : "W";
    var kingSquare : Square;

    for (var i = 0; i<8; i++)
    {
      for (var j = 0; j<8; j++)
      {
        if (this.board[i][j] == king)
          kingSquare = { file : i, rank : j };
      }
    }

    return this.attackedSquare(kingSquare, otherColor);
  }

  legalMovesSquare (square : Square) : Array<Move>
  {
    //TODO: Check for draw by 50 moves rule
    var legalMoves = [];
    var moves = this.preLegalMovesSquare(square);
    var sideToMove = this.sideToMove;

    moves.forEach(move => {
      this.doMove(move);
      //Check that king is not in check
      if (!this.inCheck(sideToMove)) legalMoves.push(move);
      this.undoMove(move);
    });

    return legalMoves;
  }

  legalMoves () : Array<Move> {
    var moves : Array<Move> = [];
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        if (this.board[i][j] && pieceColor(this.board[i][j]) == this.sideToMove) {
          moves = moves.concat(this.legalMovesSquare({ file : i, rank : j }));
        }
      }
    }
    return moves;
  }

  attackedSquare (s : Square, byColor : Color) : boolean
  {
    var found = false;
    for (var file = 0; file < 8; file ++)
    {
      for (var rank = 0; rank < 8; rank ++)
      {
        if (this.board[file][rank] && pieceColor(this.board[file][rank]) == byColor)
        {
          var moves = this.preLegalMovesSquare({ file : file, rank : rank }, true);
          moves.forEach(move => {
            if (move.target.file == s.file && move.target.rank == s.rank) found = true;
          });
          if (found) return true;
        }
      }
    }

    return false;
  }

  placePiece (piece : Piece, square : Square) {
    this.board[square.file][square.rank] = piece;
  }

  doMove (m : Move)
  {
    var p : Piece = this.board[m.source.file][m.source.rank];
    this.board[m.source.file][m.source.rank] = null;
    this.board[m.target.file][m.target.rank] = m.promote ? m.promote : p;
    if (m.captureSquare) this.board[m.captureSquare.file][m.captureSquare.rank] = null;

    //Castling
    if (p.toUpperCase() == "K" && m.source.file == 4 && (m.target.file == 6 || m.target.file == 2))
    {
      if (m.target.file == 6) //Kingside
      {
        this.board[5][m.target.rank] = this.board[7][m.target.rank];
        this.board[7][m.target.rank] = null;
      }

      if (m.target.file == 2) //Queenside
      {
        this.board[3][m.target.rank] = this.board[0][m.target.rank];
        this.board[0][m.target.rank] = null;
      }
    }

    if (p.toUpperCase() == "K")
    {
      if (pieceColor(p) == "W") { this.castlingFlags.whiteKing = false;  this.castlingFlags.whiteQueen = false; }
      if (pieceColor(p) == "B") { this.castlingFlags.blackKing = false;  this.castlingFlags.blackQueen = false; }
    }

    if (m.source.file == 0 && m.source.rank == 0) this.castlingFlags.whiteQueen = false;
    if (m.source.file == 7 && m.source.rank == 0) this.castlingFlags.whiteKing = false;
    if (m.source.file == 0 && m.source.rank == 7) this.castlingFlags.blackQueen = false;
    if (m.source.file == 7 && m.source.rank == 7) this.castlingFlags.blackQueen = false;

    if (m.capturedPiece || p.toUpperCase() == "P") this.halfMoveClock = 0; else this.halfMoveClock++;
    this.plyCount++;
    this.sideToMove = this.sideToMove == "W" ? "B" : "W";
  }

  undoMove (m : Move) : void {
    var originalPiece : Piece;
    var sideToMove = this.sideToMove == "W" ? "B" : "W";
    
    if (m.promote) {
      originalPiece = "P";
      if (sideToMove == "B") originalPiece = "p";
    } else {
      originalPiece = this.board[m.target.file][m.target.rank];
    }

    this.board[m.source.file][m.source.rank] = originalPiece;
    this.board[m.target.file][m.target.rank] = null;

    if (m.capturedPiece)
    {
      if (m.captureSquare)
        this.board[m.captureSquare.file][m.captureSquare.rank] = m.capturedPiece;
      else
        this.board[m.target.file][m.target.rank] = m.capturedPiece;
    }

    //Castling
    if (originalPiece.toUpperCase() == "K" && m.source.file == 4 && (m.target.file == 6 || m.target.file == 2))
    {
      if (m.target.file == 6) // Kingside
      {
        this.board[7][m.target.rank] = this.board[5][m.target.rank];
        this.board[5][m.target.rank] = null;
      }
      
      if (m.target.file == 2) //Queenside
      {
        this.board[0][m.target.rank] = this.board[3][m.target.rank];
        this.board[3][m.target.rank] = null;
      }
    }

    this.castlingFlags.whiteKing = m.castlingFlags.whiteKing;
    this.castlingFlags.whiteQueen = m.castlingFlags.whiteQueen;
    this.castlingFlags.blackKing = m.castlingFlags.blackKing;
    this.castlingFlags.blackQueen = m.castlingFlags.blackQueen;
    this.halfMoveClock = m.halfMoveClock;

    this.plyCount--;
    this.sideToMove = this.sideToMove == "W" ? "B" : "W";
  }

  moveToSAN (m : Move) : string {
    var res = "";
    var sourcePiece = this.board[m.source.file][m.source.rank];
    
    // Castling
    if (sourcePiece && sourcePiece.toUpperCase() == "K" && m.source.file == 4 && (m.target.file == 2 || m.target.file == 6)) {
      if (m.target.file > m.source.file) return "O-O"; else return "O-O-O";
    }

    switch (sourcePiece.toUpperCase()) {
      case "B" : res += "B"; break;
      case "N" : res += "N"; break;
      case "R" : res += "R"; break;
      case "K" : res += "K"; break;
      case "Q" : res += "Q"; break;
      case "P" : if (m.capturedPiece) res += String.fromCharCode('a'.charCodeAt(0) + m.source.file);
    }

    var ambiguousFile = null;
    var ambiguousRank = null;

    if (sourcePiece.toUpperCase() !== "P")
    {
      for (var i = 0; i < 8; i++)
        for (var j = 0; j < 8; j++)
        {
          if (this.board[i][j] == sourcePiece && (i !== m.source.file || j !== m.source.rank)) {
            var moves = this.preLegalMovesSquare({ file : i, rank : j }, true);
            moves.forEach(newMove => {
              if (newMove.target.file == m.target.file && newMove.target.rank == m.target.rank) {
                if (newMove.source.file !== m.source.file)
                  ambiguousFile = m.source.file;
                else
                  ambiguousRank = m.source.rank;
              }
            });
          }
        }
    }

    if (ambiguousFile) res += String.fromCharCode('a'.charCodeAt(0) + ambiguousFile);
    if (ambiguousRank) res += String.fromCharCode('1'.charCodeAt(0) + ambiguousRank);

    if (m.capturedPiece) res += "x";
    res += String.fromCharCode('a'.charCodeAt(0) + m.target.file);
    res += String.fromCharCode('1'.charCodeAt(0) + m.target.rank);

    if (m.promote) res += "=" + m.promote.toUpperCase();

    this.doMove(m);
    var inCheck = this.inCheck(this.sideToMove);
    var hasMoves = this.legalMoves().length > 0;
    this.undoMove(m);

    if (inCheck && hasMoves) res += "+";
    else if (inCheck && !hasMoves) res += "#";
    else if (!hasMoves) res += "=";

    //TODO: Check stalemate & checkmate

    return res;
  }

  cloneCastlingFlags () : CastlingFlags {
    return { whiteKing : this.castlingFlags.whiteKing
           , whiteQueen : this.castlingFlags.whiteQueen
           , blackKing : this.castlingFlags.blackKing
           , blackQueen : this.castlingFlags.blackQueen
           };
  }

  sanToMove (move : string) : Move {
    var moves : Array<Move> = [];
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        if (this.board[i][j] && pieceColor(this.board[i][j]) == this.sideToMove) {
          moves = moves.concat(this.legalMovesSquare({ file : i, rank : j }));
        }
      }
    }

    for (var z = 0; z < moves.length; z++) {
      if (move == this.moveToSAN(moves[z]))
        return moves[z];
    }

    throw new Error("Invalid move: " + move);
  }

  asciiBoard () : string {
    var out = "";
    for (var x = 0; x < 8; x++)
    {
      for (var y = 0; y < 8; y++)
      {
        out += this.board[y][7-x] || " ";
        out += "|";
      }
      out += "\n";
    }
    return out;
  }
}
