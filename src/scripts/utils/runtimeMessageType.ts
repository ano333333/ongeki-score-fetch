import scoreConstDataType from "./scoreConstDataType";
import userScoreDataType from "./userScoreDataType";

type runtimeMessageType =
    | {
          target: "offscreen";
          type: "user_score_domparse_start";
          html: string;
          diff: string;
      }
    | {
          target: "background";
          type: "user_score_domparse_end";
          diff: string;
          datas: userScoreDataType[];
      }
    | {
          target: "background";
          type: "domparse_error";
          diff: string;
          error: Error;
      }
    | {
          target: "offscreen";
          type: "score_const_domparse_start";
          html: string;
      }
    | {
          target: "background";
          type: "score_const_domparse_end";
          datas: scoreConstDataType[];
      }
    | {
          target: "background";
          type: "log";
          message: string;
      }
    | {
          target: "background";
          type: "trigger_logic";
      }
    | {
          target: "background";
          type: "login_info_check";
      }
    | {
          target: "popup";
          type: "login_info_result";
          result: boolean;
      };

export default runtimeMessageType;
