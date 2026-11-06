export function quizUrl(code:string){return `${window.location.origin}${import.meta.env.BASE_URL}join/${encodeURIComponent(code)}`}
