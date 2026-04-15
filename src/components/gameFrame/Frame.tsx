import React, { useEffect } from "react";

export default function Frame() {
    useEffect(() => {
        const html = document.documentElement;
        const body = document.body;
        const root = document.getElementById("root");

        const previousHtmlBackground = html.style.background;
        const previousBodyBackground = body.style.background;
        const previousRootBackground = root?.style.background ?? "";
        const previousBodyMargin = body.style.margin;
        const previousHtmlHeight = html.style.height;
        const previousBodyHeight = body.style.height;
        const previousRootHeight = root?.style.height ?? "";

        html.style.background = "transparent";
        body.style.background = "transparent";
        body.style.margin = "0";
        html.style.height = "100%";
        body.style.height = "100%";

        if (root) {
            root.style.background = "transparent";
            root.style.height = "100%";
        }

        return () => {
            html.style.background = previousHtmlBackground;
            body.style.background = previousBodyBackground;
            body.style.margin = previousBodyMargin;
            html.style.height = previousHtmlHeight;
            body.style.height = previousBodyHeight;

            if (root) {
                root.style.background = previousRootBackground;
                root.style.height = previousRootHeight;
            }
        };
    }, []);

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: "transparent",
            }}
        >
            <iframe
                title="Map Frame"
                src="/"
                style={{
                    width: "100%",
                    height: "100%",
                    border: "0",
                    display: "block",
                    background: "transparent",
                }}
            />
        </div>
    );
}
