import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sourceRoot = resolve(import.meta.dirname, '..');

const datasets = [
  {
    output: 'public/data/redlining-san-francisco.geojson',
    url: 'https://services.arcgis.com/ak2bo87wLfUpMrt1/arcgis/rest/services/MappingInequalityRedliningAreas_231211/FeatureServer/0/query?where=city%3D%27San%20Francisco%27%20AND%20state%3D%27CA%27&outFields=*&returnGeometry=true&f=geojson&outSR=4326',
  },
  {
    output: 'public/data/east-bay-school-districts.geojson',
    url: 'https://services3.arcgis.com/fdvHcZVgB2QSRNkL/arcgis/rest/services/DistrictAreas2526/FeatureServer/0/query?where=CountyName%3D%27Contra%20Costa%27&geometry=-122.30%2C37.67%2C-121.75%2C38.10&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&inSR=4326&outFields=DistrictName%2CDistrictType%2CCountyName&returnGeometry=true&f=geojson&outSR=4326',
  },
];

for (const dataset of datasets) {
  const response = await fetch(dataset.url);
  if (!response.ok) throw new Error(`Could not download ${dataset.output}: ${response.status}`);

  const output = resolve(sourceRoot, dataset.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(await response.json())}\n`);
}
