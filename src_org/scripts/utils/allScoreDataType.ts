import userScoreDataType from "./userScoreDataType";

type allScoreDataType = userScoreDataType & { const: number | undefined };

export default allScoreDataType;
