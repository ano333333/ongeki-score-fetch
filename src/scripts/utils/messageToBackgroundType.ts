type messageToBackgroundType =
    | {
          type: "triggerLogic";
      }
    | {
          type: "loginInfoCheck";
      };

export default messageToBackgroundType;
