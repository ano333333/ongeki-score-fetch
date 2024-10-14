//オンゲキnetから取得する、ユーザーのスコア情報
type userScoreDataType = {
    difficulty: string;
    level: string;
    name: string;
    genre: string;
    technicalHighScore: number;
    overDamageHighScore: number;
    battleHighScore: number;
    fullBell: boolean;
    allBreak: boolean;
};

export default userScoreDataType;
