// If I change, please update my header comment.
// input: route params/client data
// output: page UI
// pos: route page entry
import { SpeakerManagement } from "@/components/tts/SpeakerManagement";

export default function SpeakersPage() {
  return (
    <div className="container mx-auto p-6">
      <SpeakerManagement />
    </div>
  );
}
