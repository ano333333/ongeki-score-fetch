type logicProgressType =
    | {
          type: "progress";
          message: string;
      }
    | {
          type: "finish";
      }
    | {
          type: "error";
          message: string;
      };

export default logicProgressType;
