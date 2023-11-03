import scoreDataType from "./scoreDataType";

type runtimeMessageType =
    | {
          target: "offscreen";
          type: "domparse_start";
          html: string;
          diff: string;
      }
    | {
          target: "background";
          type: "domparse_end";
          diff: string;
          datas: scoreDataType[];
      }
    | {
          target: "background";
          type: "domparse_error";
          diff: string;
          error: Error;
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
