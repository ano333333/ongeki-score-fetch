import { ref, computed } from "vue";
import { loginInfoKeys, loginInfoType } from "./loginInfoType";
export default class dataFetchClass {
    private loginInfo = ref<loginInfoType>({});
    public fetchLoginInfo() {
        //ログイン情報をcookieから取得
        return Promise.all(
            loginInfoKeys.map((name) =>
                this.fetchCookie(name).then((value) => {
                    if (value) {
                        this.loginInfo.value = {
                            ...this.loginInfo.value,
                            [name]: value,
                        };
                    }
                })
            )
        );
    }
    public isLoginInfoValid = computed(() => {
        return (
            this.loginInfo.value !== undefined &&
            this.loginInfo.value._t !== undefined &&
            this.loginInfo.value.segaId !== undefined &&
            this.loginInfo.value._ga_92875CKHN5 !== undefined &&
            this.loginInfo.value._gcl_au !== undefined &&
            this.loginInfo.value._gid !== undefined &&
            this.loginInfo.value.friendCodeList !== undefined &&
            this.loginInfo.value.userId !== undefined &&
            this.loginInfo.value._ga_WDQDR0Y1TP !== undefined &&
            this.loginInfo.value._ga !== undefined
        );
    });
    private fetchCookie(name: string) {
        return new Promise((resolve: (value?: string) => any) => {
            chrome.cookies.get(
                { url: "https://ongeki-net.com", name: name },
                (cookie) => {
                    const now = new Date();
                    if (
                        cookie &&
                        (!cookie.expirationDate ||
                            cookie.expirationDate > now.getTime() / 1000)
                    ) {
                        resolve(name);
                    } else {
                        resolve(undefined);
                    }
                }
            );
        });
    }
}
