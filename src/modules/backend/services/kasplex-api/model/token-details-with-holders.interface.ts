import { ITokenHolder } from './token-holder.interface';

export interface ITokenDetailsWithHolders {
  tick: string;
  max: string;
  lim: string;
  dec: string;
  minted: string;
  opScoreAdd: string;
  opScoreMod: string;
  state: string;
  hashRev: string;
  mtsAdd: string;
  holderTotal: string;
  transferTotal: string;
  mintTotal: string;
  holder: ITokenHolder[];
}
