import { redirect } from "next/navigation";
type Props = {
    params: Promise<{
        id: string;
    }>;
};
export default async function VideoScriptRedirectPage({ params }: Props) {
    const { id } = await params;
    redirect(`/applications/${id}/mock-interview`);
}
