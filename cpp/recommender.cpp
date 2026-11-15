#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <string>
#include <vector>

namespace py = pybind11;

struct Strategy {
    std::string name;
    std::string description;
    std::string benefits;
    std::string risks;
};

std::vector<Strategy> recommend(
    double soil_moisture,
    double rainfall_30d,
    const std::string& priority
) {
    std::vector<Strategy> strategies;

    // =====================================
    // 1. CONDIÇÕES DE SECA
    // =====================================

    if (soil_moisture < 0.15 || rainfall_30d < 30.0) {
        strategies.push_back({
            "Rotação resistente à seca",
            "Considerar culturas adaptadas a períodos de baixa disponibilidade de água.",
            "Pode reduzir a exposição das culturas ao défice hídrico.",
            "A escolha depende do clima local, do solo e das necessidades das culturas."
        });
    }

    // =====================================
    // 2. SAÚDE DO SOLO
    // =====================================

    if (priority == "soil_health" ||
        priority == "soil_fertility") {

        strategies.push_back({
            "Rotação com leguminosas",
            "Considerar a inclusão de culturas leguminosas na rotação.",
            "Pode contribuir para a fertilidade do solo através da fixação biológica de azoto.",
            "Os resultados dependem das espécies utilizadas e das condições do solo."
        });
    }

    // =====================================
    // 3. CONSERVAÇÃO DA ÁGUA
    // =====================================

    else if (priority == "water_conservation") {

        strategies.push_back({
            "Rotação com culturas de baixa necessidade hídrica",
            "Considerar culturas que necessitem de menos água durante o seu ciclo de desenvolvimento.",
            "Pode ajudar a reduzir a procura de água para irrigação.",
            "A adequação depende da precipitação local, do solo e das culturas disponíveis."
        });
    }

    // =====================================
    // 4. PRODUTIVIDADE AGRÍCOLA
    // =====================================

    else if (priority == "crop_productivity") {

        strategies.push_back({
            "Rotação diversificada de culturas",
            "Alternar culturas com diferentes necessidades nutricionais e ciclos de desenvolvimento.",
            "Pode contribuir para uma utilização mais equilibrada dos recursos do solo.",
            "A produtividade depende também das variedades, da época de plantação e das condições locais."
        });
    }

    // =====================================
    // 5. ADAPTAÇÃO CLIMÁTICA
    // =====================================

    else if (priority == "climate_adaptation") {

        strategies.push_back({
            "Rotação com culturas adaptadas às condições climáticas",
            "Considerar culturas com diferentes níveis de tolerância ao calor e à variabilidade da precipitação.",
            "Pode ajudar a diversificar os riscos associados às alterações climáticas.",
            "A seleção deve considerar as projeções climáticas e as condições agrícolas locais."
        });
    }

    // =====================================
    // 6. ESTRATÉGIA GENÉRICA
    // =====================================

    if (strategies.empty()) {

        strategies.push_back({
            "Rotação diversificada",
            "Alternar culturas com características diferentes.",
            "Pode reduzir a dependência de uma única cultura.",
            "É necessário considerar as condições locais."
        });
    }

    return strategies;
}

// =====================================
// PYTHON BINDINGS
// =====================================

PYBIND11_MODULE(farm_engine, m) {

    py::class_<Strategy>(m, "Strategy")
        .def_readonly("name", &Strategy::name)
        .def_readonly("description", &Strategy::description)
        .def_readonly("benefits", &Strategy::benefits)
        .def_readonly("risks", &Strategy::risks);

    m.def("recommend", &recommend);
}